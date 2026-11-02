const {
  parseOptions,
  resetPassword,
  runCli,
} = require("./_lib/admin-users");

if (require.main === module) {
  runCli(() =>
    resetPassword(
      parseOptions(
        process.argv.slice(2),
        ["username", "confirm-db"],
        ["dry-run", "confirm-production"],
      ),
    ),
  );
}
