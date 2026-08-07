import { Button, Typography } from '@material-ui/core';
import { Link as RouterLink } from 'react-router-dom';
import { InfoCard } from '@backstage/core-components';

// The template list seeds its category picker from the `type` entity filter,
// read out of the query string in qs-bracket form (useEntityListProvider ->
// queryParameters -> useEntityTypeFilter). Aspect adoption templates are
// spec.type: aspect, so this lands with only the adoption doors showing.
//
// The path must be `/create/templates`, NOT `/create`: the latter is a shell
// that redirects to the list, and the redirect drops the query string — the
// page then renders every template. Same base path as useActions' deep links.
const CREATE_ASPECT_TEMPLATES = '/create/templates?filters[type]=aspect';

// The unenrolled half of the adoption decoration: a component that has adopted
// no aspect gets the Create-page door rather than an empty card. Gated by
// extension config (see the plugin README) so an organisation that finds this
// naggy can switch it off without code.
export function AdoptAspectCard() {
  return (
    <InfoCard title="Aspects">
      <Typography variant="body2" color="textSecondary" style={{ marginBottom: 12 }}>
        Not enrolled in any aspect.
      </Typography>
      {/* Router Link, not <a href> — an anchor would full-page-reload the app,
          the pattern the 2026-07-22 review flagged on the Actions panel.
          core-components' Link would avoid the react-router-dom import but its
          props don't satisfy MUI v4's Button `component` overload. */}
      <Button component={RouterLink} to={CREATE_ASPECT_TEMPLATES} variant="outlined" size="small">
        Adopt an aspect
      </Button>
    </InfoCard>
  );
}
