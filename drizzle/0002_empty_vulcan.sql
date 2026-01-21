ALTER TABLE `employees` ADD `employeeNumber` varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE `employees` ADD `password` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_employeeNumber_unique` UNIQUE(`employeeNumber`);