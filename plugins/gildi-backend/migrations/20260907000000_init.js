/*
 * Append-only: one row per run, never an upsert. That makes the history
 * chartable and dissolves the "keep last-good or overwrite on error" question
 * rather than answering it — an errored run is simply another row and the
 * previous good one still exists. See design §8.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('gildi_trial_runs', table => {
    table.increments('id').primary();
    table.string('entity_ref').notNullable();
    table.string('aspect_id').notNullable();
    table.dateTime('run_at').notNullable();
    table.string('kind').notNullable();
    table.string('module_release').nullable();
    table.string('medal').nullable();
    table.text('suppressed_reasons').nullable();
    // NULL, not zero, on an unevaluated run: zero applicable is a real and
    // different claim — the standard loaded and nothing applied.
    table.integer('applicable').nullable();
    table.integer('passing').nullable();
    table.text('outcomes').nullable();
    table.string('unevaluated_reason').nullable();
    table.text('unevaluated_detail').nullable();
    table.index(['entity_ref', 'aspect_id', 'run_at'], 'gildi_trial_runs_subject_idx');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTable('gildi_trial_runs');
};
