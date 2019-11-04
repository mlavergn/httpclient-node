###############################################
#
# Makefile
#
###############################################

.DEFAULT_GOAL := build

deps:
	npm install typescript rxjs @types/node tslint rxjs-tslint-rules --save-dev

lint: clean
	./node_modules/tslint/bin/tslint --project tslint.json *.ts test/*.ts

build: lint
	# ES5 for IE11 compat
	tsc -t ES5 --lib es2017,dom --alwaysStrict -d -diagnostics **.ts

test: build
	tsc -t ES5 --lib es2017,dom --alwaysStrict -d -diagnostics test/**.ts
	node test/testhttpclient

install: build
	npm install --save

clean:
	rm -rf **.js **.d.ts test/**.js test/**.d.ts browser/test.js browser/**.d.ts

distclean: clean
	rm -rf node_modules
	rm -f package-lock.json

browser: build
	tsc -t ES5 --lib es2017,dom --alwaysStrict -d -diagnostics browser/**.ts
	open -a Safari "http://127.0.0.1:8000/index.html"

www:
	go run svc/main.go
