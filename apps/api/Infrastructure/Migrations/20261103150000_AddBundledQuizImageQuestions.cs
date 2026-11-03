using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EscapeRoom.Api.Infrastructure.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261103150000_AddBundledQuizImageQuestions")]
public partial class AddBundledQuizImageQuestions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DO $$
            DECLARE
                quiz_game_id uuid;
                image_challenge_id uuid;
            BEGIN
                SELECT "Id"
                INTO quiz_game_id
                FROM "Games"
                WHERE "Slug" = 'trafikverket-uppdraget'
                LIMIT 1;

                IF quiz_game_id IS NULL THEN
                    RETURN;
                END IF;

                SELECT c."Id"
                INTO image_challenge_id
                FROM "Challenges" c
                JOIN "ChallengeOptions" o ON o."ChallengeId" = c."Id"
                WHERE c."GameId" = quiz_game_id
                  AND o."IsCorrect" = TRUE
                  AND o."Text" = 'Huvudled'
                LIMIT 1;

                IF image_challenge_id IS NULL THEN
                    UPDATE "Challenges"
                    SET "SortOrder" = "SortOrder" + 1
                    WHERE "GameId" = quiz_game_id
                      AND "SortOrder" >= 2;

                    image_challenge_id := gen_random_uuid();
                    INSERT INTO "Challenges"
                        ("Id", "GameId", "Prompt", "ImagePath", "SortOrder", "TimeLimitSeconds", "IsActive", "IsEnabled")
                    VALUES
                        (image_challenge_id, quiz_game_id, 'Vad är det för skylt?', '/assets/images/quiz/main-road.png', 2, NULL, TRUE, TRUE);

                    INSERT INTO "ChallengeOptions"
                        ("Id", "ChallengeId", "Text", "SortOrder", "IsCorrect", "SortingCategory", "MatchingIconKey")
                    VALUES
                        (gen_random_uuid(), image_challenge_id, 'Huvudled', 1, TRUE, NULL, NULL),
                        (gen_random_uuid(), image_challenge_id, 'Körfält upphör', 2, FALSE, NULL, NULL),
                        (gen_random_uuid(), image_challenge_id, 'Väjningsplikt', 3, FALSE, NULL, NULL),
                        (gen_random_uuid(), image_challenge_id, 'Huvudled upphör', 4, FALSE, NULL, NULL);
                ELSE
                    UPDATE "Challenges"
                    SET "ImagePath" = '/assets/images/quiz/main-road.png'
                    WHERE "Id" = image_challenge_id;
                END IF;

                SELECT c."Id"
                INTO image_challenge_id
                FROM "Challenges" c
                JOIN "ChallengeOptions" o ON o."ChallengeId" = c."Id"
                WHERE c."GameId" = quiz_game_id
                  AND o."IsCorrect" = TRUE
                  AND o."Text" = 'Påbjuden körriktning'
                LIMIT 1;

                IF image_challenge_id IS NULL THEN
                    image_challenge_id := gen_random_uuid();
                    INSERT INTO "Challenges"
                        ("Id", "GameId", "Prompt", "ImagePath", "SortOrder", "TimeLimitSeconds", "IsActive", "IsEnabled")
                    VALUES
                        (
                            image_challenge_id,
                            quiz_game_id,
                            'Vad är det för skylt?',
                            '/assets/images/quiz/mandatory-direction.png',
                            COALESCE((SELECT MAX("SortOrder") + 1 FROM "Challenges" WHERE "GameId" = quiz_game_id), 1),
                            NULL,
                            TRUE,
                            TRUE
                        );

                    INSERT INTO "ChallengeOptions"
                        ("Id", "ChallengeId", "Text", "SortOrder", "IsCorrect", "SortingCategory", "MatchingIconKey")
                    VALUES
                        (gen_random_uuid(), image_challenge_id, 'Påbjuden körbana', 1, FALSE, NULL, NULL),
                        (gen_random_uuid(), image_challenge_id, 'Cirkulationsplats', 2, FALSE, NULL, NULL),
                        (gen_random_uuid(), image_challenge_id, 'Påbjuden gångbana', 3, FALSE, NULL, NULL),
                        (gen_random_uuid(), image_challenge_id, 'Påbjuden körriktning', 4, TRUE, NULL, NULL);
                ELSE
                    UPDATE "Challenges"
                    SET "ImagePath" = '/assets/images/quiz/mandatory-direction.png'
                    WHERE "Id" = image_challenge_id;
                END IF;
            END $$;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // This content migration is intentionally retained on rollback so that
        // administrator-managed questions are never deleted implicitly.
    }
}
