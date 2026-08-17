import packageJson from '../../package.json';

export const appInfo = {
  productName: packageJson.productName,
  version: packageJson.version,
  developer: 'OliverCJ'
} as const;
