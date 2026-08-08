import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCommentsTable1786199115970 implements MigrationInterface {
  name = 'CreateCommentsTable1786199115970';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "comments" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"content" text NOT NULL, ` +
        `"taskId" uuid NOT NULL, ` +
        `"authorId" uuid NOT NULL, ` +
        `"createdAt" TIMESTAMP NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_comments" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_task" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_author"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_task"`,
    );
    await queryRunner.query(`DROP TABLE "comments"`);
  }
}
