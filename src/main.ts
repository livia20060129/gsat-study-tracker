import './styles.css';
import './homepage.css';
import { initializeNativePlatform } from './native/bootstrap.ts';
import { initializeTrackerLayout } from './ui/trackerLayout.ts';
import { initializeDisclosureMotion } from './ui/disclosureMotion.ts';
if (await initializeNativePlatform()) {
  await import('./legacy-app');
  initializeTrackerLayout();
  initializeDisclosureMotion();
}
