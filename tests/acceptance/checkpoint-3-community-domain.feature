Feature: Phase 3 community domain seed
  The MTL seed models the community hierarchy with built-in kinds plus one Cycle.

  Scenario: the seed declares the MTL org Group tree
    Given the MTL seed file
    Then it declares a Group "mtl" of type "organization"
    And it declares a Group "soccer-u8-red" of type "team"

  Scenario: the seed declares a season Cycle wired to its league and field
    Given the MTL seed file
    Then it declares a Cycle "soccer-2026-spring" of type "season"
    And that Cycle is "of" group "mtl-soccer"
    And that Cycle "happensAt" resource "field-1"

  Scenario: the catalog allows the Cycle kind
    Given the app-config catalog rules
    Then the "mtl.yaml" location allows the "Cycle" kind
