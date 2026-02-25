CREATE TABLE `staff_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`dueDate` varchar(10),
	`priority` enum('low','medium','high') DEFAULT 'medium',
	`status` enum('pending','in_progress','completed') DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_tasks_id` PRIMARY KEY(`id`)
);
