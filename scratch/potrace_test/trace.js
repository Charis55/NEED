const potrace = require('potrace');
const fs = require('fs');

potrace.trace('../../public/LOGO.png', function(err, svg) {
  if (err) throw err;
  fs.writeFileSync('output.svg', svg);
  console.log('Successfully traced to output.svg');
});
