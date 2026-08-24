import './styles.css';

// Stage 1 migration:
// Existing production behavior is loaded from a compatibility TypeScript module.
// Typed modules already exist for the high-risk domains and can be migrated
// incrementally without changing the user's stored records.
import './legacy-app';
