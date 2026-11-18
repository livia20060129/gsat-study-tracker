import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version as string;
const build = Number(version.split('.').at(-1));
if (!/^\d+\.\d+\.\d+$/.test(version) || !Number.isSafeInteger(build) || build < 1) throw new Error('Invalid native version');
function edit(path: string, change: (text: string) => string): void {
  const file = resolve(root, path), before = readFileSync(file, 'utf8'), after = change(before);
  if (before !== after) writeFileSync(file, after);
}
edit('android/app/src/main/AndroidManifest.xml', text => {
  text = text.replace('android:allowBackup="true"', 'android:allowBackup="false"');
  if (!text.includes('android:usesCleartextTraffic=')) text = text.replace('<application', '<application android:usesCleartextTraffic="false"');
  if (!text.includes('gsattracker')) text = text.replace('</activity>', `
            <!-- GSAT fixed OAuth callbacks. Authorization still requires PKCE or signed Calendar state. -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="gsattracker" android:host="auth" android:pathPrefix="/" />
            </intent-filter>
        </activity>`);
  return text;
});
edit('android/app/build.gradle', text => text.replace(/versionCode \d+/, 'versionCode ' + build).replace(/versionName "[^"]+"/, 'versionName "' + version + '"'));
edit('ios/App/App/Info.plist', text => {
  text = text.replace(/(<key>CFBundleDevelopmentRegion<\/key>\s*<string>)en(<\/string>)/, '$1zh-Hant$2');
  if (!text.includes('<string>gsattracker</string>')) text = text.replace('<key>CFBundleDevelopmentRegion</key>', `
    <key>CFBundleURLTypes</key><array><dict>
      <key>CFBundleURLName</key><string>dev.liviayeh.gsat</string>
      <key>CFBundleURLSchemes</key><array><string>gsattracker</string></array>
    </dict></array>
    <key>CFBundleDevelopmentRegion</key>`);
  return text;
});
edit('ios/App/App.xcodeproj/project.pbxproj', text => {
  text = text.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, 'CURRENT_PROJECT_VERSION = ' + build + ';')
    .replace(/MARKETING_VERSION = [^;]+;/g, 'MARKETING_VERSION = ' + version + ';')
    .replace(/IPHONEOS_DEPLOYMENT_TARGET = [^;]+;/g, 'IPHONEOS_DEPLOYMENT_TARGET = 16.4;');
  if (!text.includes('/* PrivacyInfo.xcprivacy in Resources */')) {
    text = text.replace('/* Begin PBXBuildFile section */', '/* Begin PBXBuildFile section */\n\t\tAA1900000000000000000001 /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = AA1900000000000000000002 /* PrivacyInfo.xcprivacy */; };');
    text = text.replace('/* Begin PBXFileReference section */', '/* Begin PBXFileReference section */\n\t\tAA1900000000000000000002 /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };');
    const appGroup = /(\/\* App \*\/ = \{[\s\S]*?children = \()/;
    if (!appGroup.test(text)) throw new Error('iOS App group not found');
    text = text.replace(appGroup, '$1\n\t\t\t\tAA1900000000000000000002 /* PrivacyInfo.xcprivacy */,');
    const resources = /(isa = PBXResourcesBuildPhase;[\s\S]*?files = \()/;
    if (!resources.test(text)) throw new Error('iOS Resources phase not found');
    text = text.replace(resources, '$1\n\t\t\t\tAA1900000000000000000001 /* PrivacyInfo.xcprivacy in Resources */,');
  }
  return text;
});
console.log('Native project configuration verified: ' + version + ' (build ' + build + ')');
