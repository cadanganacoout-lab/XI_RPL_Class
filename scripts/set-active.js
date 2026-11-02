const {
  parseOptions,
  runCli,
  setActive,
} = require("./_lib/admin-users");

if (require.main === module) {
  runCli(() =>
    setActive(
      parseOptions(
        process.argv.slice(2),
        ["username", "active", "confirm-db"],
        ["dry-run", "confirm-production"],
      ),
    ),
  );
}
