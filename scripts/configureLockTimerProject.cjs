const fs = require('node:fs');
const crypto = require('node:crypto');
const xcode = require('xcode');

module.exports = function configureLockTimerProject(version, build) {
  const path = 'ios/App/App.xcodeproj/project.pbxproj';
  const project = xcode.project(path); project.parseSync();
  const objects = project.hash.project.objects;
  const app = project.getFirstTarget().uuid;
  const mainGroup = objects.PBXProject[project.getFirstProject().uuid].mainGroup;
  const stableId = value => crypto.createHash('sha256').update('gsat-lock-timer:' + value).digest('hex').slice(0, 24).toUpperCase();
  function group(name) {
    const id = stableId('group:' + name);
    objects.PBXGroup[id] ||= { isa: 'PBXGroup', children: [], path: name, sourceTree: '"<group>"' };
    objects.PBXGroup[id + '_comment'] = name;
    if (!objects.PBXGroup[mainGroup].children.some(child => child.value === id)) objects.PBXGroup[mainGroup].children.push({ value: id, comment: name });
    return id;
  }
  const appGroup = Object.entries(objects.PBXGroup).find(([key, value]) => !key.endsWith('_comment') && value.path === 'App')[0];
  objects.PBXTargetDependency ||= {};
  objects.PBXContainerItemProxy ||= {};
  let widget = Object.entries(objects.PBXNativeTarget).find(([key, value]) => !key.endsWith('_comment') && String(value.name).replaceAll('"', '') === 'StudyTimerWidget')?.[0];
  if (!widget) widget = project.addTarget('StudyTimerWidget', 'app_extension', 'StudyTimerWidget', 'dev.liviayeh.gsat.timer').uuid;
  if (!objects.PBXNativeTarget[app].dependencies.some(item => objects.PBXTargetDependency[item.value]?.target === widget)) {
    const dependency = stableId('widget-dependency'), proxy = stableId('widget-proxy');
    objects.PBXContainerItemProxy[proxy] = { isa: 'PBXContainerItemProxy', containerPortal: project.getFirstProject().uuid,
      proxyType: 1, remoteGlobalIDString: widget, remoteInfo: 'StudyTimerWidget' };
    objects.PBXContainerItemProxy[proxy + '_comment'] = 'PBXContainerItemProxy';
    objects.PBXTargetDependency[dependency] = { isa: 'PBXTargetDependency', target: widget, targetProxy: proxy };
    objects.PBXTargetDependency[dependency + '_comment'] = 'StudyTimerWidget';
    objects.PBXNativeTarget[app].dependencies.push({ value: dependency, comment: 'StudyTimerWidget' });
  }
  const product = objects.PBXNativeTarget[widget].productReference;
  for (const key of ['fileEncoding', 'lastKnownFileType']) {
    if (objects.PBXFileReference[product]?.[key] == null || objects.PBXFileReference[product]?.[key] === 'undefined') delete objects.PBXFileReference[product][key];
  }
  for (const phase of Object.values(objects.PBXCopyFilesBuildPhase ?? {})) {
    if (typeof phase !== 'object' || phase.dstSubfolderSpec != 13) continue;
    for (const file of phase.files) {
      const entry = objects.PBXBuildFile[file.value];
      if (entry?.fileRef === product) entry.settings = { ATTRIBUTES: ['RemoveHeadersOnCopy'] };
    }
  }
  for (const [type, name] of [['PBXSourcesBuildPhase', 'Sources'], ['PBXFrameworksBuildPhase', 'Frameworks'], ['PBXResourcesBuildPhase', 'Resources']]) {
    if (!objects.PBXNativeTarget[widget].buildPhases.some(phase => objects[type]?.[phase.value])) project.addBuildPhase([], type, name, widget);
  }
  function source(file, groupId, target) {
    const reference = stableId(groupId + ':' + file);
    objects.PBXFileReference[reference] ||= { isa: 'PBXFileReference', lastKnownFileType: file.endsWith('.plist') ? 'text.plist.xml' : 'sourcecode.swift', path: file, sourceTree: '"<group>"' };
    objects.PBXFileReference[reference + '_comment'] = file;
    if (!objects.PBXGroup[groupId].children.some(child => child.value === reference)) objects.PBXGroup[groupId].children.push({ value: reference, comment: file });
    if (file.endsWith('.plist')) return;
    const buildId = stableId(reference + ':' + target);
    objects.PBXBuildFile[buildId] ||= { isa: 'PBXBuildFile', fileRef: reference, fileRef_comment: file };
    objects.PBXBuildFile[buildId + '_comment'] = file + ' in Sources';
    const sources = objects.PBXNativeTarget[target].buildPhases.map(phase => objects.PBXSourcesBuildPhase[phase.value]).find(Boolean);
    if (!sources.files.some(item => item.value === buildId)) sources.files.push({ value: buildId, comment: file + ' in Sources' });
  }
  const shared = group('SharedTimer'), widgetGroup = group('StudyTimerWidget');
  for (const file of ['StudyBridgeViewController.swift', 'StudyLockTimerEngine.swift', 'StudyLockTimerPlugin.swift']) source(file, appGroup, app);
  for (const target of [app, widget]) for (const file of ['StudyTimerAttributes.swift', 'StudyTimerIntent.swift']) source(file, shared, target);
  source('StudyTimerWidget.swift', widgetGroup, widget); source('Info.plist', widgetGroup, widget);
  const configurations = objects.XCConfigurationList[objects.PBXNativeTarget[widget].buildConfigurationList].buildConfigurations;
  for (const configuration of configurations) Object.assign(objects.XCBuildConfiguration[configuration.value].buildSettings, {
    PRODUCT_BUNDLE_IDENTIFIER: 'dev.liviayeh.gsat.timer', PRODUCT_NAME: '"$(TARGET_NAME)"', SDKROOT: 'iphoneos',
    INFOPLIST_FILE: 'StudyTimerWidget/Info.plist', GENERATE_INFOPLIST_FILE: 'YES', SWIFT_VERSION: '5.0',
    SWIFT_ACTIVE_COMPILATION_CONDITIONS: '"$(inherited) WIDGET_EXTENSION"', APPLICATION_EXTENSION_API_ONLY: 'YES',
    IPHONEOS_DEPLOYMENT_TARGET: '16.4', TARGETED_DEVICE_FAMILY: '"1,2"', CODE_SIGN_STYLE: 'Automatic',
    MARKETING_VERSION: version, CURRENT_PROJECT_VERSION: build, SKIP_INSTALL: 'YES',
  });
  const after = project.writeSync(); if (after !== fs.readFileSync(path, 'utf8')) fs.writeFileSync(path, after);
};
