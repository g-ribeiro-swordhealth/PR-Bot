.PHONY: install start dev test-manual lint lint-fix

ARGS := $(wordlist 2, $(words $(MAKECMDGOALS)), $(MAKECMDGOALS))
$(eval $(ARGS):;@true)

install:
	npm install

start:
	node entrypoint/http/index.js

dev:
	node entrypoint/http/index.js

test-manual:
	node test/manual/index.js $(ARGS)

lint:
	npx eslint .

lint-fix:
	npx eslint . --fix
