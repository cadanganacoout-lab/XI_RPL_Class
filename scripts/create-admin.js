const {
  createAdmin,
  parseOptions,
  runCli,
} = require("./_lib/admin-users");

if (require.main === module) {
  runCli(() =>
    createAdmin(
      parseOptions(
        process.argv.slice(2),
        ["username", "name", "confirm-db"],
        ["dry-run", "confirm-production"],
      ),
    ),
  );
}
