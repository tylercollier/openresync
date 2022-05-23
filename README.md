# OpenReSync

![OpenReSync logo](https://user-images.githubusercontent.com/366538/144324447-cfa1c275-9bad-47d7-aff5-57a3af297f48.png)

Open Real Estate Sync (openresync) is a node application that syncs (replicates) MLS data from one or more sources via the RESO Web API (such as Trestle, MLS Grid, or Bridge Interactive) to one or more destinations (MySQL and Solr are supported so far, and it's easy enough to add more), and allows you to see the sync status via a local website.

It is meant to be used by developers.

It does the syncing for you, and helps you answer these questions:

* How closely does my data match the MLS's data?
* When did the last sync occur and was it successful?
* What is the most recent record (e.g. listing)?

## Website

Want to convince your boss to use this tool, so that you can actually spend your time working on your team's product instead of syncing MLS data? Send them to https://openresync.com.

## Project status

This project is in alpha status. It is meant for those who could benefit from what it does enough to offset the downside of likely shortcomings.

The initial major version is 0, which means that [semantic versioning](https://semver.org/) is not yet followed.

This project is now being used in production by the author, using REcolorado and CRMLS (California Regional MLS) via Trestle, and Realtracs via MLS Grid.

## Features

* Sync any number of sources. As in, you can connect to multiple MLS systems.
* Sync any number of resources, or subsets using `$filter`
  * You are able to utilize `$select` and `$expand`
* For each source, you can sync to one or more destinations
  * At this time, MySQL and Solr are supported as destinations. You could have any number of such destinations. Adding a new destination type isn't difficult.
  * The destination schema is managed for you (at least for MySQL). The tables and fields are created if they don't exist.
* Logging is done in [ndjson](http://ndjson.org/) format, so that if you have to go digging through the logs, this is as easy as possible. Be sure to look into [pino-pretty](https://github.com/pinojs/pino-pretty), which is a dev dependency, so you can use it with e.g. `cat somelogfile | npx pino-pretty`.
* A local website runs so you can see the sync stats.

### Screenshots

Sync from multiple sources (MLSs):

![Sync from multiple sources (MLSs)](https://user-images.githubusercontent.com/366538/141699264-3c50c475-8c73-4981-90dd-69e4849ab608.png)

See details per source, such as the cron schedule, how many records are in the MLS vs in your destinations, and the sync (and purge) histories:

![See details per source](https://user-images.githubusercontent.com/366538/141699258-73cb1fa8-3d06-40de-8840-c94c3fffddd0.png)

See all the cron schedules at once, which makes it easier to not overlap them:

![See all the cron schedules at once](https://user-images.githubusercontent.com/366538/141699270-975690d3-7bea-46d7-a8ad-83813a5298f4.png)

## How do I use it?

Install the app, configure it, build it, start the back-end server (and optionally start the dev web server), and visit the local website that runs. These are described in the following steps.

### Installation

```
$ git clone https://github.com/tylercollier/openresync
$ cd openresync
# optional: switch to the dev branch to get the newest but less tested features
$ git checkout dev
$ npm install
```

### Configure it

Configuration is a larger topic with its own dedicated section below.

### Build it

If you are running in production, you need to build the JS and CSS assets.

```
$ npm run build
```

> If you run the dev web server, you do not need to build.

### Run it

#### Start the server

**Here's how to run it in development:**

> If you run this dev web server, you do not need to run the build step above.

The following will start nodemon and watch several directories and restart the server when any files are changed. The second line starts the front-end (webpack) dev server for when you change Vue components.

```
$ npm run dev
$ npm run serve
```

Then visit the website at http://localhost:3461

**Here's how to run it in production:**

```
$ NODE_ENV=production TZ=UTC node server/index.js
```

Then visit the website at http://localhost:4000

You might also want to add this environment variable: `NODE_OPTIONS=--max_old_space_size=4096`. That sets the max memory allowed by node, in kilobytes (node's default is 2048). It's only necessary when you are using the reconcile process on large datasets, so it's suggested you only use it if you get out-of-memory errors.

## Configuration

See the heavily commented `config/config.example.js`. Copy it to `config/config.js` and edit it according to your needs. At a high level, you'll be specifying:

* sources: where to download data from
* resources: which data to download from the MLS, e.g. Property, Media, Member, etc
* destinations: where to put that data

**Considerations**

* In the screenshots, you can see source names like `recolorado_res`, `recolorado_rentals`, `recolorado_land`. In my production scenario, I'm breaking the data from the Property resource into separate buckets for those 3 different property types. This isn't required, and would probably be discouraged for people starting from scratch. However, I did it this way to keep compatability with my legacy systems that used to connect to the data sources via RETS and expected these buckets. I consider this a good thing: that you have the power to do it this way if you choose.
* Are you using MLS Grid as a source? See [docs/mlsgrid.md](docs/mlsgrid.md) in this repo.

There is an internal configuration file that you should be aware of, which is described in the "How does it work?" section.

### .env

It's recommended to put secrets in a `.env` file. These will be read automatically using the `dotenv` library and available for your config file in `process.env` values.

There's no `example.env` type of file because there are no standard fields you should configure. For example, in a project that uses the Austin Board of Realtors sample dataset, you might use environment variables like ABOR_CLIENT_ID and ABOR_CLIENT_SECRET to store your Oauth credentials, and then you could reference them with e.g. `process.env.ABOR_CLIENT_ID` in your `config/config.js` file. There's no particular recommendation other than you keep your secrets out of the git repository.

## How does it work?

You should know these basics so you can debug problems.

This level of detail is supplied because this is alpha software, and as such the likelyhood that you'll discover a bug is higher. Your feedback is appreciated.

### Sync (aka replication) process

To properly replicate MLS data via the RESO Web API, there are 3 processes which you must understand. They are `sync`, `purge`, and `reconcile`, and are described below. For an MLS with few records, you could get away with only using reconcile and purge, but it's probably best to use all 3.

A note on the terms: there are no industry standard names for these processes, so their meanings as used in this project might not have the exact same meaning elsewhere.

#### Overview

Each of the 3 processes is described below, but let's take a minute to describe what's happening at a high level.

Each process does 3 things:

1. Determine what needs to be downloaded
2. Connect to the MLS and download the data
3. Process the data, meaning alter the destinations by inserting/updating/deleting data

When the data is downloaded, it is always completely downloaded before it is processed. There will be multiple files if there are more records to download than the MLS allows in a single page.

Downloaded data is stored in the following subdirectory of the project: `config/sources/${sourceName}/downloadedData/${resourceName}/`. So if you had named a source `abor_Trestle` and the resource name was `Property`, the path would be `config/sources/abor_Trestle/downloadedData/Property`.

The file names of downloaded data follow a pattern. It's this: `${type}_batch_${batchId}_seq_${timestamp}.json`, where:

* `type` is one of the 3 processes (the `reconcile` process also has subprocesses that use `missing` and `missingIds`)
* `batchId` is a timestamp of when the process was started
* `sequenceId` is a timestamp of when the particular file finished downloading (there might be many files per batch)

After the data is downloaded, it will be processed in a batch, matching all files with the oldest batch ID. The files will be processed in order, looping over each destination before moving on to the next file. This is so that each destination is as close to in-sync as possible (as opposed to syncing all files for the batch to one destination, and then doing all files for the next destination, and so on). After the file has been used for each destination successfully, it is deleted.

For each of the processes, the state is recorded in the internal config file (discussed below). This allows the processes to resume from where they left off, whether they were in the middle of downloading a batch of data, or processing the downloaded files. The exception is the purge process, which always starts over. If an error occurs, this will be recorded. And if 3 errors occur for a process, that process will not be tried again; you will need to examine the error and resolve it.

#### Sync

The sync process adds or updates records (no deletions). To know what to download from the MLS, the destination (or first destination, if you have multiple) is queried to get the most recent timestamp. Then, the MLS is queried for records with a newer timestamp. If there is an error when downloading the files, then when the sync process is next run, instead of querying the destination for the newest record, it will look newest record in the newest file.

Note that the first sync might take hours depending on the platform and number of records in the MLS and if you filter any out. However, subsequent syncs generally run quite quickly so it's reasonable to run it, say, every 15 minutes.

#### Purge

Purging is when the MLS removes records. We need to mirror those removals by removing those same records from our destinations. To be able to know which records have been removed, we download all the IDs from the MLS, and compare them to the IDs in each of our destinations. It therefore takes longer than the sync process and uses more memory.

The purge process is similar to the sync process but differs in 2 important ways.

1. There is no resuming the download process. It always downloads the entirety of the data. This is unfortunate and could be improved but is the simplest approach to handle the Trestle, MLS Grid, and Bridge Interactive platforms in the same way, which reduces code complexity.
2. The downloaded files are not processed one by one, but instead must be loaded into memory all at once to compare to what's in the destinations. After the purge is complete, all downloaded files for the resource are deleted.

Trestle calls purging "reconciliation" in their docs. Do not confuse it with our dis-similar reconcile process.

#### Reconcile

Reconciling ensures all your records match what's in the MLS by getting what's missing or different from the MLS (thus it never deletes data). In theory, the sync process should be all you need to get data into your destinations, but in practice, records are missed frequently.

You could also have some arbitrary requirement to update a subset of records. All you'd need to do is modify one of the timestamp fields on any such records, and the reconcile process would get/update them.

It works like this. First it downloads IDs and timestamps for each record in the resource (these files start with `reconcile_batch`). Then it grabs the IDs and timestamps for each record from each destination. For any IDs that are missing or timestamps that don't match between the MLS or one of the destinations, the ID is recorded into a file whose name starts with `missingIds_batch`. This file is then read and all records are downloaded using `$filter=` with a list of IDs, resulting in files whose names start with `missing_batch`.

The `missing_batch` files are then processed, inserting/updating into the destination(s).

### Stats

As the program runs, it records certain statistics in the configured database, such as when a sync starts, finishes, whether it was successful, how many records were synced, etc. It is these stats that are shown on the website. To see which tables are created, check `lib/stats/setUp.js`.

### Internal config

As the program runs, it records its internal state in a file at `config/internalConfig.json`. For example, for each MLS source, it captures where it's at in the download process, as well as the sync, purge, and reconcile processes, including each resource and destination. This is so it knows where to resume if there is a problem.

### Logging

Log files are output for each MLS source. See the `logs` folder.

Logging is done in [ndjson](http://ndjson.org/) format, so that if you have to go digging through the logs, this is as easy as possible. Be sure to look into [pino-pretty](https://github.com/pinojs/pino-pretty), which is a dev dependency, so you can use it with e.g. `cat somelogfile | npx pino-pretty`.


## Customizing

It is not recommended to change any code. Or if you do, do so in a new branch. Otherwise it will be difficult for you to upgrade when new versions are released. If you need behavior that doesn't exist, it would be best to create a feature request issue in Github. We need samples from the wild to know what features would be useful.

## Q&A

**Question:** Why would I use this tool and sync data locally, rather than querying the RESO Web API directly?  
**Answer:** It's true that the RESO Web API is generally superior to the older RETS standard, and one reason is it allows you to efficiently query the API for specific results that could then e.g. be shown on a website. However, here are a number of use cases to sync the data locally.

  In the following list, there are ideas that are beyond what this application does on its own. But you'd have the power to take things another step and accomplish things the RESO Web API can't.

  * Aggregates like "What's the median price?", or "What's the average number of pictures per listing?"
  * Massage data
    * E.g. in Phoenix, Ahwatukee is not a city, but people treat it like one. You could make searches done by your users automatically turn requests for the village (not city) of Ahwatukee into a search for the 3 zip codes representing Ahwatukee.
    * Make your own fields. For example, there is no address field, but you could make your own. This could simplify your code.
  * Full text search, e.g. searching the public remarks field using full stemming. This would likely require an extra destination not currently offered, such as Elastic Search. But the point is that this can't currently be done via RESO Web API.
  * Reference other fields 
    * E.g. say I want to do a query to see where ModificationTimestamp != MediaModificationTimestamp on the Media resource. But you can't do such a complex query in RESO Web API.
  * Basically anything the RESO Web API doesn't offer. For example, some platforms offer polygon searches. But you can't e.g. search with a simple centroid and radius. If you build your own API using the data synced by this tool, you could do such a thing.

(If you don't fit into any of the cases listed above, then you will probably be better off querying the MLS platform directly.)

Another advantage of syncing the data and creating your own API is you basically avoid quota limits.

**Question:** So it just syncs the data? Is that useful? Can I e.g. show the data on a website?  
**Answer:** Yes, it just syncs the data. But this is the mission of this project and should be a large chunk of any work needed to produce your own project that uses the data. You'll still have work left to do such as field mapping (especially if you use multiple MLS sources and intend to harmonize their data and show it in one place consistently). Of course whether you're allowed to show the data publicly is a legal concern you'll need to talk with each MLS about.

**Question:** Can I use other RESO Web API sources besides Trestle, MLS Grid, or Bridge Interactive?
**Answer:** Yes! At least one user is running in production with UtahRealEstate.com. Others,like [Spark](https://landing.sparkplatform.com/), haven't been tested yet, but the codebase is set up to add more without too much work.

**Question:** How many sources can I realistically sync at once?  
**Answer:** Because a lot of the work done can be offloaded from node (e.g. downloading files, writing JSON files to disk, sending data to MySQL, etc), it's likely a bunch. (I'm currently doing 9 in production.) I would still recommend trying to offset the cron schedules from one another. For example, if you sync source A every 15 minutes starting on the hour, you might consider syncing source B every 15 minutes starting at 5 minutes past the hour. Another factor is if you'll be writing to the same table or different ones. For example, if you're just doing Property records from different MLSs and write to a single Property table, you might get lock problems. But if you use different MySQL databases per source, or use the `makeTableName` concept to prefix your table names such that two sync processes aren't writing to the same table, MySQL will probably be able to handle it just fine.

**Question:** Do I have to use the web server?  
**Answer:** No. You could use the code in the `lib/sync` dir as a library and run the download, sync, and purge processes as you see fit. See `lib/sync/go.js` as an example. I intend to turn the sync code into its own npm module eventually.

## Known limitations

1. One of the main value propositions of this application is to make it robust in error handling. It is desired that the application not crash and wisely show error situations to the user. However, this has not been tested thoroughly. Some errors might be swallowed altogether. Some errors are quite verbose and we don't shorten these yet. It would definitely be great to catch 502 and 504 errors from the platforms and retry downloads, but this is not done yet.
1. The Solr data adapter does not yet sync/manage the schema for you (though the MySQL data adapter does).

## Roadmap

* Get me the data for record X from the MLS
  * As in, allow me to type in a ListingId, MemberKey, etc, etc, and show it to me in a user-friendly way, and allow me to compare it to what's in the destinations.
* During a sync, how many have been synced so far, how many to go, and estimate of completion time
* Alert me when a sync fails, via email, text, etc
  * Or fails too many times in a row (some threshold)
* Split the website code from the sync code. Turn at least the sync code into an npm module.
* Rewrite in TypeScript so the project is more self documenting

## Contributing / Contact

I'm very interested in working with others to use the application and getting their feedback in the form of features requests, bug reports, and so on. Please create issues or reach out directly. My email address is shown on my github profile page, or you can use the contact information on the website at https://openresync.com.
