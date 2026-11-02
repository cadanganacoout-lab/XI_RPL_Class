const {
  createStudent,
  parseOptions,
  runCli,
} = require("./_lib/admin-users");

if (require.main === module) {
  runCli(() =>
    createStudent(
      parseOptions(
        process.argv.slice(2),
        ["username", "name", "card", "confirm-db"],
        ["dry-run", "confirm-production"],
      ),
    ),
  );
}
