#!/bin/zsh
set -e
module=digest
npx tsc
npx browserify --external axios --standalone foo $module.js > $module.bundle.js
lzfse -encode -i $module.bundle.js > $module.bundle.js.lzfse
rm $module.bundle.js