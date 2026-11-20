import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { NATIVE_AUTH_RETURN_URL, NATIVE_CALENDAR_RETURN_URL } from '../src/native/nativePolicy.ts';

const read = (path: string) => readFileSync(resolve(path), 'utf8');
const version = JSON.parse(read('package.json')).version;
const android = read('android/app/src/main/AndroidManifest.xml'), ios = read('ios/App/App/Info.plist');
assert.match(android, /android:scheme="gsattracker" android:host="auth"/);
assert.match(android, /android:usesCleartextTraffic="false"/);
assert.match(android, /android:allowBackup="false"/);
assert.match(read('android/variables.gradle'), /targetSdkVersion = 36/);
assert.match(read('android/app/build.gradle'), new RegExp('versionName "' + version.replaceAll('.', '\\.') + '"'));
assert.match(ios, /<string>gsattracker<\/string>/);
assert.match(read('ios/App/App.xcodeproj/project.pbxproj'), /PrivacyInfo.xcprivacy in Resources/);
assert.match(read('ios/App/App/PrivacyInfo.xcprivacy'), /C617.1/);
assert.match(read('ios/App/App.xcodeproj/project.pbxproj'), /TARGETED_DEVICE_FAMILY = "1,2"/);
assert.match(read('ios/App/App.xcodeproj/project.pbxproj'), /IPHONEOS_DEPLOYMENT_TARGET = 16.4/);
assert.match(android, /android.permission.POST_NOTIFICATIONS/);
assert.match(android, /StudyLockTimerReceiver" android:exported="false"/);
assert.match(ios, /<key>NSSupportsLiveActivities<\/key><true\/>/);
const project = createRequire(import.meta.url)('xcode').project(resolve('ios/App/App.xcodeproj/project.pbxproj'));
project.parseSync();
const objects = project.hash.project.objects;
const widget = Object.entries(objects.PBXNativeTarget).find(([key, value]) => !key.endsWith('_comment') && String((value as {name:string}).name).includes('StudyTimerWidget'));
assert.ok(widget, 'Missing timer widget extension target');
assert.ok(objects.PBXNativeTarget[project.getFirstTarget().uuid].dependencies.some((item: {value:string}) =>
  objects.PBXTargetDependency?.[item.value]?.target === widget[0]), 'App must build the widget extension dependency');
assert.ok(!/\bundefined\b/.test(read('ios/App/App.xcodeproj/project.pbxproj')), 'Invalid generated Xcode property');
function sources(target: string): string[] {
  return objects.PBXNativeTarget[target].buildPhases.flatMap((phase: {value:string}) => (objects.PBXSourcesBuildPhase[phase.value]?.files ?? [])
    .map((file: {value:string}) => objects.PBXFileReference[objects.PBXBuildFile[file.value].fileRef]?.path));
}
const appSources = sources(project.getFirstTarget().uuid), widgetSources = sources(widget[0]);
for (const file of ['StudyTimerAttributes.swift','StudyTimerIntent.swift']) { assert.ok(appSources.includes(file)); assert.ok(widgetSources.includes(file)); }
for (const file of ['StudyLockTimerEngine.swift','StudyLockTimerPlugin.swift','StudyBridgeViewController.swift']) assert.ok(appSources.includes(file));
assert.ok(widgetSources.includes('StudyTimerWidget.swift'));
assert.ok(Object.values(objects.PBXCopyFilesBuildPhase ?? {}).some(value => typeof value === 'object' && (value as {dstSubfolderSpec:number}).dstSubfolderSpec == 13), 'Widget must be embedded in the app');
assert.match(read('capacitor.config.ts'), /webDir: 'dist-native'/);
assert.ok(!read('capacitor.config.ts').includes('server: { url:'), 'native app must bundle its own pages');
assert.equal(NATIVE_AUTH_RETURN_URL, 'gsattracker://auth/callback?google_auth=1');
assert.equal(NATIVE_CALENDAR_RETURN_URL, 'gsattracker://auth/calendar');
assert.match(read('supabase/functions/google-calendar-callback/index.ts'), /nativeApp \? 'gsattracker:\/\/auth\/calendar'/);
for (const page of ['index.html','todo.html','summary.html','material.progress.html','vocabulary.review.html','privacy.html','gpt.prompt.html']) {
  assert.ok(existsSync('dist-native/' + page), 'Missing native page: ' + page);
}
assert.ok(!existsSync('dist-native/app-worker.js'), 'native build must not install a web update worker');
assert.ok(readdirSync('dist-native/dictionaries/ecdict-v1').length > 1);
const icon = readFileSync('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
assert.equal(icon.readUInt32BE(16), 1024); assert.equal(icon.readUInt32BE(20), 1024);
console.log('Native configuration v' + version + ': target API 36, iPhone/iPad timer widget target and dependency, callbacks, bundled pages and App icon verified. Native OS compilation is a separate step.');
