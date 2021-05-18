# openresync

Open Real Estate Sync (openresync) is a node application that syncs (replicates) MLS data from one or more sources via the RESO Web API (such as Trestle or Bridge Interactive) to one or more destinations (only MySQL is supported so far), and allows you to see the sync status via a local website.

It is meant to be used by developers.

It does the syncing for you, and helps you answer these questions:

* When did the last sync occur and was it successful?
* What is the most recent record (e.g. listing)?

## Project status

This project is in alpha status. It is meant for those who could benefit from what it does enough to offset the downside of likely bugs.

The initial major version is 0, which means that [semantic versioning](https://semver.org/) is not yet followed.

This code is not being used in production by the author yet.

## Features

* Sync any number of sources. As in, you can connect to multiple MLS systems.
* Sync any number of resources, or subsets using `$filter`
  * You are able to utilize `$select` and `$expand`
* For each source, you can sync to one or more destinations
  * At this time, only MySQL is supported as a destination. (Multiple different MySQL destinations could be used.) However, adding a new destination shouldn't be difficult and more are planned.
  * The destination schema is managed for you. For example, the tables and fields are created if they don't exist.
* Logging is done in [ndjson](http://ndjson.org/) format, so that if you have to go digging through the logs, this is as easy as possible. Be sure to look into [pino-pretty](https://github.com/pinojs/pino-pretty), which is a dev dependency, so you can use it with e.g. `cat somelogfile | npx pino-pretty`.

### Screenshots

Sync from multiple sources (MLSs):

![Sync from multiple sources (MLSs)](https://user-images.githubusercontent.com/366538/114815106-65815100-9d6a-11eb-8cf2-7ae0dd78146f.png)

See details per source, such as the cron schedule, how many records are in the MLS vs in your destinations, and the sync (and purge) histories:

![See details per source](https://user-images.githubusercontent.com/366538/114815112-69ad6e80-9d6a-11eb-8e3e-89f828c9ecab.png)

See all the corn schedules at once, which makes it easier to not overlap them:

![See all the cron schedules at once](https://user-images.githubusercontent.com/366538/114815117-6c0fc880-9d6a-11eb-8751-6683b8569238.png)

## How do I use it?

Install the app, configure it, start the back-end server, start the web server, and visit the local website that runs.

### Installation

`$ git clone https://github.com/tylercollier/openresync`

`$ npm install`

### Configure it

Configuration is a larger topic with its own dedicated section

### Run it

#### Start the server

`npm run dev`

#### Start the front-end server

`npm run serve`

Then visit the website at http://localhost:3461

#### How to run in production

As mentioned, this code is not yet being run in production by the author yet. You do so at your own risk.

## Configuration

See the heavily commented `config/config.example.js`. Copy it to `config/config.js` and edit it according to your needs.

There is an internal configuration file you should be aware of, which is described in the "How does it work?" section.

### .env

It's recommended to put secrets in a .env file. These will be read automatically using the `dotenv` library and available for your config file in `process.env` values.

There's no `example.env` type of file because there are no standard fields you should configure. For example, in a project that uses the Austin Board of Realtors sample dataset, you might use environment variables like ABOR_CLIENT_ID and ABOR_CLIENT_SECRET to store your Oauth credentials, and then you could reference them with e.g. `process.env.ABOR_CLIENT_ID` in your `config/config.js` file. There's no particular recommendation other than you keep your secrets out of the git repository.

## How does it work?

You should know these basics so you can debug problems.

This level of detail is supplied because this is alpha software, and as such the likelyhood that you'll discover a bug is higher. Your feedback is appreciated.

### Server

The server is responsible for hosting the cron jobs that do the sync work as well as providing an API for the website that shows the stats.

### Sync (aka replication) process

There is an initial sync and an ongoing sync. The initial sync could take hours depending on the platform and number of records in the MLS and if you filter out any. The ongoing sync would be expected to only take a minute or less if you run it say every 15 minutes.

At a high level, first the data is downloaded from the MLS and put into files in a different directory for each resource. Once all are successfully downloaded, the sync process will go through all the files and sync the data to each destination. If there is an error, it will be logged, and retried on the next run.

#### Download

For each MLS source, and for each of its resources, we need to determine if this is the first sync, or if we have synced before and we should supply a `$filter=ModificationTimestamp gt X` query parameter. The former is just a special case of the latter and we use a timestamp of the Unix epoch. To get the timestamps, we first look if there are any previously downloaded files, and if so the latest file will be used. Otherwise, we look into the first destination specified (all destinations would be expected to report the same value though).

Whenever you start a download, we create a batch ID, which is basically a timestamp, and if you resume, we find the oldest batch ID. The JSON files will be downloaded to the directory `config/sources/${sourceName}/downloadedData/${resourceName}`, where the file name is based on the batch ID as well as when that particular file finished downloading. There will be multiple files if there are more records to download than the MLS allows in a single page.

Only after all resources are downloaded do we consider the download batch successful. Until it is, we use the internal config (described below) to track where we are in the process. When complete, we remove the download batch section in the internal config.

#### The sync process (insert into destinations)

When the actual sync process runs, as in the portion that takes the data from the downloaded JSON files and inserts (or updates) the data in the destinations, it will determine the oldest batch based on filenames in the downloaded data directories, and then process all the files with that batch ID, from oldest to newest. It will process the files one by one. It will insert into each destination, until that destination reports success, before moving on to the next file. This is so that each destination is as close to in sync as possible, as opposed to syncing all files for the batch to one destination, and then doing all files for the next destination, and so on. After the file has been used to insert data into each destination successfully, it is deleted.

If an error occurs, this is recorded in the internal config, but the sync will be retried as part of the next cron job. However if 3 errors occur, no attempt to process will be made. You will need to examine the failure and resolve.

### Purge (aka reconciliation) process

The purge process is similar to the sync process but differs in 2 important ways.

1. There is no resuming the download process. It always downloads the entirety of the data. This is unfortunate and could be improved but is the simplest approach to handle Trestle and Bridge Interactive in the same way, which reduces code complexity.
1. The downloaded files are not processed one by one, but instead must be loaded into memory all at once to compare to what's in the destinations. After the purge is complete, all downloaded files for the resource are deleted.

### Stats

As the program runs, it records certain statistics in the configured database, such as when a sync starts, finishes, whether it was successful, how many records were synced etc. It is these stats that are shown on the website. To see which tables are created, check `lib/stats/setUp.js`.

### Internal config

As the program runs, it records its internal state in a file at `config/internalConfig.json`. For example, for each MLS source, it captures where it's at in the download process, and the sync and purge processes, including each resource and destination. This is so it knows where to resume if there is a problem.

### Logging

Log files are output for each MLS source. See the `logs` folder.

Logging is done in [ndjson](http://ndjson.org/) format, so that if you have to go digging through the logs, this is as easy as possible. Be sure to look into [pino-pretty](https://github.com/pinojs/pino-pretty), which is a dev dependency, so you can use it with e.g. `cat somelogfile | npx pino-pretty`.


## Customizing

It is not recommended to change any code. Or if you do, do so in a new branch. Otherwise it will be difficult for you to upgrade when new versions are released. If you need behavior that doesn't exist, it would be best to create a feature request issue in Github. We need samples from the wild to know what features would be useful.

## Q&A

**Q:** Why would I use this tool and sync data locally, rather than querying the RESO Web API directly?  
**A:** It's true that the RESO Web API is generally superior to the older RETS standard, and one reason is it allows you to efficiently query the API for specific results that could then e.g. be shown on a website. However, here are a number of use cases to sync the data locally. (If you don't fit into any of the cases listed below, then you will probably be better off querying the MLS platform directly.)

  In the following list, there are ideas that are beyond what this application does on its own. But you'd have the power to take things another step and accomplish things the RESO Web API can't.

  * Aggregates like "What's the median price?", or "What's the average number of pictures per listing?"
  * Massage data
    * E.g. in Phoenix, Ahwatukee is not a city, but people treat it like one. You could make searches done by your users automatically turn requests for the village (not city) of Ahwatukee into a search for the 3 zip codes representing Ahwatukee.
    * Make your own fields. For example, there is no address field, but you could make your own. This could simplify your code.
  * Full text search, e.g. searching the public remarks field using full stemming. This would likely require an extra destination not currently offered, such as Elastic Search. But the point is that this can't currently be done via RESO Web API.
  * Reference other fields 
    * E.g. say I want to do a query to see where ModificationTimestamp != MediaModificationTimestamp on the Media resource. But you can't do such a complex query in RESO Web API.
  * Basically anything the RESO Web API doesn't offer. For example, some platforms offer polygon searches. But you can't e.g. search with a simple centroid and radius. If you build your own API using the data synced by this tool, you could do such a thing.

Another advantage of syncing the data and creating your own API is you basically avoid quota limits.

**Q:** So it just syncs the data? Is that useful? Can I e.g. show the data on a website?  
**A:** Yes, it just syncs the data. But this is the mission of this project and should be a large chunk of any work needed to produce a project that uses the data. You'll still have work left to do such as field mapping (especially if you use multiple MLS sources and intend to harmonize their data and show it in one place consistently). Of course whether you're allowed to show the data publicly is a legal concern you'll need to talk with each MLS about.

**Q:** How many sources can I realistically sync at once?  
**A:** Not sure. I haven't tried more than one at a time. Because a lot of the work done can be offloaded from node (e.g. downloading files, writing JSON files to disk, sending data to MySQL, etc), it's likely a bunch. I would still recommend trying to offset the cron schedules from one another. Another factor is if you'll be writing to the same table or different ones. For example, if you're just doing Property records from different MLSs and write to a single Property table, you might get lock problems. But if you use different MySQL databases per source, or use the `makeTableName` concept to prefix your table names such that two sync processes aren't writing to the same table, MySQL will probably be able to handle it just fine.

**Q:** Do I have to use the web server?  
**A:** No. You could use the code in the `lib/sync` dir as a library and run the download, sync, and purge processes as you see fit. See `lib/sync/go.js` as an example. I intend to turn the sync code into its own npm module.

## Known limitations

1. One of the main value propositions of this application is to make it robust in error handling. It is desired that the application not crash and wisely show error situations to the user. However, this has not been tested thoroughly. Some errors might be swallowed altogether. Some errors are quite verbose and we don't shorten these yet. It would definitely be great to catch 502 and 504 errors from the platforms and retry downloads, but this is not done yet.

## Roadmap

* Force a sync to occur
  * Or a purge
* Get me the data for record X from the MLS
  * As in, allow me to type in a ListingId, MemberKey, etc, etc, and show it to me in a user-friendly way, and allow me to compare it to what's in the destinations.
* During a sync, how many have been synced so far, how many to go, and estimate of completion time
* Alert me when a sync fails, via email, text, etc
  * Or fails too many times in a row (some threshold)
* Split the website code from the sync code. Turn at least the sync code into an npm module.
* Rewrite in TypeScript so the project is more self documenting

## Contributing

I'm very interested in working with others to use the application and getting their feedback in the form of features requests, bug reports, and so on. Please create issues or reach out directly. My email address is shown on my github profile page.
