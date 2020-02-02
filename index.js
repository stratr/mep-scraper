const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucket = storage.bucket('mep-eu');
const Twitter = require('twitter');
require('dotenv').config();

const fs = require('fs');
const fsPromises = require("fs").promises;

const cheerio = require('cheerio')
const axios = require("axios");

// gcloud functions deploy mepScraper --env-vars-file .env.yaml --runtime nodejs10 --trigger-topic scrape_mep_details --timeout 180s
// node -e 'require("./index").mepScraper()'

const keListId = 203337069; // id of the list that has all the screen names of the meps
// TODO: replace this with another self maintained list?

const client = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN_KEY,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
});

const fetchData = async (siteUrl) => {
    const result = await axios.get(siteUrl);
    return cheerio.load(result.data);
};

const getMeps = async (data) => {
    const siteUrl = "https://www.eduskunta.fi/FI/kansanedustajat/Sivut/Kansanedustajat-aakkosjarjestyksessa.aspx";

    const $ = await fetchData(siteUrl);
    const linkItems = $('#maincontent #WebPartWPQ2 div.link-item'); // the elements that contain mep details

    if (linkItems && linkItems.length > 190) {

        // scrape mep information from the site
        const mepsFetched = [];
        linkItems.each((i, elem) => {
            const name = $(elem).find('a').text();
            const party = $(elem).find('div.description').text();
            mepsFetched[i] = { name: name, party: party, screen_name: null };
        });

        // download the previously collected data from Storage
        const oldMepsFile = await downloadFile(bucket.file('meps.json')); // how to handle if he file doesn't exist?
        // read into ndjson
        const mepsOldJson = readNdJson(oldMepsFile.toString());

        // compare the scraped data to the data already in storage
        const newMeps = mepsFetched.filter(mep => {
            return !includesMep(mep, mepsOldJson);
        });

        console.log(newMeps.length + ' new meps found.');
        if (newMeps.length > 0) { console.log(newMeps) };

        // add new meps to the json
        const updatedMeps = mepsOldJson.concat(newMeps);

        // Get all the Twitter user names to fetch
        const listMembers = await fetchMembers({ list_id: keListId, count: 300 });
        const memberScreenNames = listMembers.users.map(member => { return { screen_name: member.screen_name, name: member.name } });

        // Check the updated meps for meps with missing screen_name
        let snFound = false;
        updatedMeps.forEach(mep => {
            if (typeof mep.screen_name !== 'string') {
                const twitterDetails = memberScreenNames.find(member => {
                    return mep.name === member.name;
                });
                if (twitterDetails) {
                    mep.screen_name = twitterDetails.screen_name;
                    snFound = true;
                }
            }
        });

        // check for the screen names that can't be connected to meps
        memberScreenNames.forEach(member => {
            const mepDetails = updatedMeps.find(mep => {
                return member.name === mep.name || member.screen_name === mep.screen_name;
            });
            if (typeof mepDetails === 'undefined') {
                console.log('Details not found for: ' + member.screen_name + ' - ' + member.name);
            }
        });

        // upload updated json to Storage
        if (updatedMeps.length >= 200) {
            if (newMeps.length > 0 || snFound) {
                const updatedFile = bucket.file('meps.json');
                const contents = writeNdJson(updatedMeps);
                updatedFile.save(contents).then(() => console.log('done'));

            } else {
                console.log('No new meps found. Aborting upload.');
            }

        } else {
            console.log('Something wrong with the meps json. Aborting upload.');
        }
    } else {
        console.log('Mep details not found from website.');
    }
}

const downloadFile = async (file) => {
    return file.download();
}

const includesMep = (mep, mepArray) => {
    const byName = mepArray.filter((elem) => {
        return elem.name === mep.name;
    });

    const byParty = byName.filter((elem) => {
        return elem.party === mep.party;
    });

    return byParty.length > 0;
}

const fetchMembers = async (params) => {
    return client.get('lists/members', params);
}

const writeNdJson = (arr) => {
    return arr.map(JSON.stringify).join('\n');
}

const readNdJson = (str) => {
    return str.length > 0 ? str.split('\n').map(JSON.parse) : [];
}

/*
This is the function that is triggered by Pub/Sub
*/
exports.mepScraper = (data) => {
    return getMeps();
};