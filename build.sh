curl -LJO https://github.com/sass/dart-sass/releases/download/1.77.8/dart-sass-1.77.8-linux-x64.tar.gz
tar -xf dart-sass-1.77.8-linux-x64.tar.gz
rm dart-sass-1.77.8-linux-x64.tar.gz &&
export PATH=/opt/build/repo/dart-sass:$PATH 

rollup --config ./rollup.config.mjs

hugo 