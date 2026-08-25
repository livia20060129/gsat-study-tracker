import './styles.css';

// Stage 1 migration:
// Existing production behavior is loaded from a compatibility TypeScript module.
// New progress logic is layered in typed modules so stored-data compatibility stays unchanged.
import './legacy-app';
import { initHistoricalMathProgressGuard } from './study/mathProgressHistory';

initHistoricalMathProgressGuard();
