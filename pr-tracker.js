require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const nodemailer = require('nodemailer');

// Configuration
const CONFIG = {
  githubToken: process.env.GITHUB_TOKEN,
  githubOrg: process.env.GITHUB_ORG,
  repos: process.env.GITHUB_REPOS ? process.env.GITHUB_REPOS.split(',').map(r => r.trim()).filter(Boolean) : [],
  teamMembers: process.env.TEAM_MEMBERS ? process.env.TEAM_MEMBERS.split(',').map(m => m.trim()).filter(Boolean) : [],
  requiredApprovals: parseInt(process.env.REQUIRED_APPROVALS || '2', 10),
  maxRetries: 3,
  perPage: 100,
  
  // Email configuration
  emailTo: process.env.EMAIL_TO,
  emailFrom: process.env.EMAIL_FROM,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
};

// Initialize clients
const octokit = new Octokit({ auth: CONFIG.githubToken });

/**
 * Retry wrapper for API calls
 */
async function withRetry(fn, retries = CONFIG.maxRetries) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) throw error;
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      console.log(`  Retry ${attempt}/${retries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Fetch all open PRs for a given repository (with pagination)
 */
async function fetchPRsForRepo(owner, repo) {
  try {
    const allPRs = [];
    let page = 1;

    while (true) {
      const { data: prs } = await withRetry(() =>
        octokit.pulls.list({
          owner,
          repo,
          state: 'open',
          per_page: CONFIG.perPage,
          page
        })
      );

      allPRs.push(...prs);

      if (prs.length < CONFIG.perPage) break;
      page++;
    }

    return allPRs;
  } catch (error) {
    console.error(`Error fetching PRs for ${owner}/${repo}:`, error.message);
    return [];
  }
}

/**
 * Get reviews for a specific PR (with retry)
 */
async function getReviews(owner, repo, pullNumber) {
  try {
    const { data: reviews } = await withRetry(() =>
      octokit.pulls.listReviews({
        owner,
        repo,
        pull_number: pullNumber
      })
    );
    return reviews;
  } catch (error) {
    console.error(`Error fetching reviews for PR #${pullNumber}:`, error.message);
    return [];
  }
}

/**
 * Count unique approvals for a PR
 */
function countApprovals(reviews) {
  // Get the latest review state from each reviewer
  const latestReviews = {};
  
  reviews.forEach(review => {
    const reviewer = review.user.login;
    if (!latestReviews[reviewer] || new Date(review.submitted_at) > new Date(latestReviews[reviewer].submitted_at)) {
      latestReviews[reviewer] = review;
    }
  });

  // Count approvals
  return Object.values(latestReviews).filter(review => review.state === 'APPROVED').length;
}

/**
 * Check if PR author is in the team members list
 */
function isTeamMember(author) {
  if (CONFIG.teamMembers.length === 0) {
    return true; // If no team members specified, track all PRs
  }
  return CONFIG.teamMembers.includes(author);
}

/**
 * Fetch all PRs needing approval
 */
async function fetchPRsNeedingApproval() {
  const prsNeedingApproval = [];

  for (const repo of CONFIG.repos) {
    console.log(`Checking repository: ${CONFIG.githubOrg}/${repo}`);
    
    const prs = await fetchPRsForRepo(CONFIG.githubOrg, repo);
    
    for (const pr of prs) {
      // Skip draft PRs
      if (pr.draft) {
        continue;
      }

      // Check if author is a tracked team member
      if (!isTeamMember(pr.user.login)) {
        continue;
      }

      const reviews = await getReviews(CONFIG.githubOrg, repo, pr.number);
      const approvalCount = countApprovals(reviews);

      if (approvalCount < CONFIG.requiredApprovals) {
        prsNeedingApproval.push({
          repo,
          number: pr.number,
          title: pr.title,
          author: pr.user.login,
          url: pr.html_url,
          approvals: approvalCount,
          createdAt: pr.created_at,
          updatedAt: pr.updated_at
        });
      }
    }
  }

  return prsNeedingApproval;
}

/**
 * Format PRs into HTML email
 */
function formatEmailHTML(prs) {
  const date = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  if (prs.length === 0) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <h2>PR Status Report</h2>
        <p>${date}</p>
        
        <p>✅ <strong>All Clear!</strong></p>
        <p>All PRs from tracked team members have the required approvals. Great work, team!</p>
        
        <div class="footer">
          <p>This is an automated message from your PR Tracker Bot.</p>
        </div>
      </body>
      </html>
    `;
  }

  // Group PRs by repository
  const prsByRepo = {};
  prs.forEach(pr => {
    if (!prsByRepo[pr.repo]) {
      prsByRepo[pr.repo] = [];
    }
    prsByRepo[pr.repo].push(pr);
  });

  let prHTML = '';
  Object.keys(prsByRepo).forEach(repo => {
    prHTML += `
      <div class="repo-section">
        <h3>📁 ${repo}</h3>
        <ul style="list-style: none; padding-left: 0;">
    `;

    prsByRepo[repo].forEach(pr => {
      const approvalIcons = '✅'.repeat(pr.approvals) + '⭕'.repeat(CONFIG.requiredApprovals - pr.approvals);
      const daysOld = Math.floor((Date.now() - new Date(pr.createdAt)) / (1000 * 60 * 60 * 24));
      
      prHTML += `
          <li class="pr-item">
            ${approvalIcons} <a href="${pr.url}" class="pr-link">#${pr.number}: ${pr.title}</a><br>
            <span style="color: #666; font-size: 0.9em;">👤 ${pr.author} • ⏱️ ${daysOld} day${daysOld !== 1 ? 's' : ''} old</span>
          </li>
      `;
    });

    prHTML += `
        </ul>
      </div>
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        .repo-section { margin-bottom: 30px; }
        .pr-item { margin-bottom: 15px; margin-left: 20px; }
        .pr-link { color: #0366d6; text-decoration: none; }
        .pr-link:hover { text-decoration: underline; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <h2>PR Status Report</h2>
      <p>${date}</p>
      
      <p>🔔 <strong>${prs.length}</strong> PR${prs.length > 1 ? 's' : ''} need${prs.length === 1 ? 's' : ''} more approvals (${CONFIG.requiredApprovals} required)</p>
      
      ${prHTML}
      
      <div class="footer">
        <p>This is an automated message from your PR Tracker Bot.</p>
        <p>Tracking ${CONFIG.repos.length} repositor${CONFIG.repos.length > 1 ? 'ies' : 'y'} in ${CONFIG.githubOrg}</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Format PRs into plain text email (fallback)
 */
function formatEmailText(prs) {
  const date = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  if (prs.length === 0) {
    return `
PR Status Report - ${date}
${'='.repeat(50)}

✅ All Clear!

All PRs from tracked team members have the required approvals.
Great work, team!

---
This is an automated message from your PR Tracker Bot.
    `.trim();
  }

  let text = `
PR Approval Status - ${date}
${'='.repeat(50)}

🔔 ${prs.length} PR${prs.length > 1 ? 's' : ''} need${prs.length === 1 ? 's' : ''} more approvals (${CONFIG.requiredApprovals} required)

`;

  // Group PRs by repository
  const prsByRepo = {};
  prs.forEach(pr => {
    if (!prsByRepo[pr.repo]) {
      prsByRepo[pr.repo] = [];
    }
    prsByRepo[pr.repo].push(pr);
  });

  Object.keys(prsByRepo).forEach(repo => {
    text += `\n📁 Repository: ${repo}\n${'-'.repeat(50)}\n`;

    prsByRepo[repo].forEach(pr => {
      const approvalIcons = '✅'.repeat(pr.approvals) + '⭕'.repeat(CONFIG.requiredApprovals - pr.approvals);
      const daysOld = Math.floor((Date.now() - new Date(pr.createdAt)) / (1000 * 60 * 60 * 24));
      
      text += `
${approvalIcons} #${pr.number}: ${pr.title}
   👤 Author: ${pr.author}
   ⏱️  Age: ${daysOld} day${daysOld !== 1 ? 's' : ''}
   🔗 ${pr.url}

`;
    });
  });

  text += `
${'='.repeat(50)}
This is an automated message from your PR Tracker Bot.
Tracking ${CONFIG.repos.length} repositor${CONFIG.repos.length > 1 ? 'ies' : 'y'} in ${CONFIG.githubOrg}
  `.trim();

  return text;
}

/**
 * Send email
 */
async function sendEmail(prs) {
  // Create transporter
  const transporter = nodemailer.createTransport({
    host: CONFIG.smtpHost,
    port: CONFIG.smtpPort,
    secure: CONFIG.smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: CONFIG.smtpUser,
      pass: CONFIG.smtpPass,
    },
  });

  const subject = prs.length === 0 
    ? '✅ PR Status: All Clear!' 
    : `🔔 ${prs.length} PR${prs.length > 1 ? 's' : ''} Need${prs.length === 1 ? 's' : ''} Approval`;

  // Send email
  try {
    const info = await transporter.sendMail({
      from: CONFIG.emailFrom,
      to: CONFIG.emailTo,
      subject: subject,
      text: formatEmailText(prs),
      html: formatEmailHTML(prs),
    });

    console.log('✅ Email sent successfully:', info.messageId);
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting PR approval tracker...\n');
  
  // Validate configuration
  if (!CONFIG.githubToken || !CONFIG.githubOrg) {
    console.error('❌ Missing required environment variables');
    console.error('Required: GITHUB_TOKEN, GITHUB_ORG');
    process.exit(1);
  }

  if (CONFIG.repos.length === 0) {
    console.error('❌ No repositories specified in GITHUB_REPOS');
    process.exit(1);
  }

  if (!CONFIG.emailTo || !CONFIG.smtpHost || !CONFIG.smtpUser || !CONFIG.smtpPass) {
    console.error('❌ Missing email configuration');
    console.error('Required: EMAIL_TO, SMTP_HOST, SMTP_USER, SMTP_PASS');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`- Organization: ${CONFIG.githubOrg}`);
  console.log(`- Repositories: ${CONFIG.repos.join(', ')}`);
  console.log(`- Team Members: ${CONFIG.teamMembers.length > 0 ? CONFIG.teamMembers.join(', ') : 'ALL'}`);
  console.log(`- Required Approvals: ${CONFIG.requiredApprovals}`);
  console.log(`- Email To: ${CONFIG.emailTo}\n`);

  // Fetch PRs
  const prsNeedingApproval = await fetchPRsNeedingApproval();
  
  console.log(`\nFound ${prsNeedingApproval.length} PR(s) needing approval\n`);

  // Send email
  await sendEmail(prsNeedingApproval);

  console.log('✅ Done!');
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { main, fetchPRsNeedingApproval };
