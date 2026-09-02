using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EscapeRoom.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameSessionTeamToPlayer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "TeamName",
                table: "GameSessions",
                newName: "PlayerName");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "PlayerName",
                table: "GameSessions",
                newName: "TeamName");
        }
    }
}
