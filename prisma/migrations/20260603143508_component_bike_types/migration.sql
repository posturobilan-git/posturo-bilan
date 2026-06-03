-- CreateTable
CREATE TABLE "_BikeTypeComponents" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BikeTypeComponents_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_BikeTypeComponents_B_index" ON "_BikeTypeComponents"("B");

-- AddForeignKey
ALTER TABLE "_BikeTypeComponents" ADD CONSTRAINT "_BikeTypeComponents_A_fkey" FOREIGN KEY ("A") REFERENCES "BikeComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BikeTypeComponents" ADD CONSTRAINT "_BikeTypeComponents_B_fkey" FOREIGN KEY ("B") REFERENCES "BikeType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

