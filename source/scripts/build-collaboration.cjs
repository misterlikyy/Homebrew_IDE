require('esbuild').buildSync({ entryPoints: [require('path').join(__dirname, '../collaboration/client.cjs')],
  outfile: require('path').join(__dirname, '../collaboration.bundle.js'), bundle: true, minify: true,
  platform: 'browser', format: 'iife', globalName: 'IDECollab', target: 'chrome130', legalComments: 'eof' });
