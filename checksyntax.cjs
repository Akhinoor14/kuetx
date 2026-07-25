const babel = require('@babel/core');
try {
  babel.transformFileSync('src/components/ProfileSetupModal.jsx', { presets: ['@babel/preset-react', '@babel/preset-env'] });
  console.log('OK');
} catch (e) {
  console.log('FAIL:', e.message);
  process.exit(1);
}
