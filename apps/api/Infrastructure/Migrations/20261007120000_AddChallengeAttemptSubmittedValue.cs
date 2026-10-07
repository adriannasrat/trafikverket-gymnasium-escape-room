using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EscapeRoom.Api.Infrastructure.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261007120000_AddChallengeAttemptSubmittedValue")]
public partial class AddChallengeAttemptSubmittedValue : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "SubmittedValue",
            table: "ChallengeAttempts",
            type: "character varying(20)",
            maxLength: 20,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "SubmittedValue", table: "ChallengeAttempts");
    }
}
