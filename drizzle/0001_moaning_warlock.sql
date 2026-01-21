CREATE TABLE `admin_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(50) NOT NULL,
	`settingValue` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_settings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `attendance_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`clockInTime` timestamp,
	`clockInLatitude` decimal(10,7),
	`clockInLongitude` decimal(10,7),
	`todayGoal` text,
	`isLate` boolean DEFAULT false,
	`clockOutTime` timestamp,
	`clockOutLatitude` decimal(10,7),
	`clockOutLongitude` decimal(10,7),
	`reflection` text,
	`isEarlyLeave` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `breaks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attendanceId` int NOT NULL,
	`startTime` timestamp NOT NULL,
	`endTime` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `breaks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attendanceId` int NOT NULL,
	`content` text NOT NULL,
	`isCompleted` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
