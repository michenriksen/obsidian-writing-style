PLUGIN_DIR ?= ~/obsidian-test-vault/.obsidian/plugins/obsidian-writing-style/

.PHONY: build
build:
	@echo ">> Building..."
	npm run build

.PHONY: build-dev
build-dev:
	@echo ">> [DEV] Build..."
	npm run build-dev

.PHONY: install
install: build
	@echo ">> Installing to Obsidian test vault..."
	cp main.js styles.css manifest.json $(PLUGIN_DIR)

.PHONY: install-dev
install-dev: build-dev
	@echo ">> [DEV] Install to Obsidian test vault..."
	cp main.js styles.css manifest.json $(PLUGIN_DIR)

