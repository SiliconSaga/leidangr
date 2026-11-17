/*
 * The facets a run resolved, and the declared ones that selected no block.
 *
 * Nullable with no default, on purpose: NULL on an existing row means the run
 * predates this and its facets are unknown. Backfilling '[]' would claim every
 * earlier run resolved facets and matched them all.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('gildi_trial_runs', table => {
    table.text('facets').nullable();
    table.text('unmatched_facets').nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('gildi_trial_runs', table => {
    table.dropColumn('facets');
    table.dropColumn('unmatched_facets');
  });
};
