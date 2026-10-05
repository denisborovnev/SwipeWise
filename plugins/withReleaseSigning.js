// Expo config plugin: signs release builds with the key described in ~/.swipewise/signing.properties
// (storeFile, storePassword, keyAlias, keyPassword). The key and its password stay outside the repo.
// Without that file, release builds fall back to the debug key (as in the default template).
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// swipewise-release-signing';

const LOAD_PROPERTIES = `
${MARKER}
def swipewiseSigning = new Properties()
def swipewiseSigningFile = new File(System.getProperty('user.home'), '.swipewise/signing.properties')
if (swipewiseSigningFile.exists()) {
    swipewiseSigningFile.withInputStream { swipewiseSigning.load(it) }
}
`;

const RELEASE_CONFIG = `
        release {
            if (swipewiseSigningFile.exists()) {
                storeFile file(swipewiseSigning['storeFile'])
                storePassword swipewiseSigning['storePassword']
                keyAlias swipewiseSigning['keyAlias']
                keyPassword swipewiseSigning['keyPassword']
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes(MARKER)) {
      return cfg;
    }
    // Load the properties before the android { } block.
    gradle = gradle.replace(/\nandroid\s*\{/, `${LOAD_PROPERTIES}\nandroid {`);
    // Add a release signing config next to the debug one.
    gradle = gradle.replace(/(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/, `$1${RELEASE_CONFIG}`);
    // Use it for release builds when the key exists.
    gradle = gradle.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig swipewiseSigningFile.exists() ? signingConfigs.release : signingConfigs.debug',
    );
    if (!gradle.includes('signingConfigs.release')) {
      throw new Error('withReleaseSigning: app/build.gradle has an unexpected layout');
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
