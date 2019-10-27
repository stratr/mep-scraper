const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucket = storage.bucket('mep-details');
const Twitter = require('twitter');
require('dotenv').config();

const fs = require('fs');
const fsPromises = require("fs").promises;

const cheerio = require('cheerio')
const axios = require("axios");

const siteUrl = "https://www.eduskunta.fi/FI/kansanedustajat/Sivut/Kansanedustajat-aakkosjarjestyksessa.aspx";

const keListId = 203337069; // id of the list that has all the screen names of the meps

const client = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN_KEY,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
});

const fetchData = async () => {
    const result = await axios.get(siteUrl);
    return cheerio.load(result.data);
};

const getMeps = async () => {
    const $ = await fetchData();
    const linkItems = $('#maincontent #WebPartWPQ2 div.link-item');
    if (linkItems && linkItems.length > 190) {

        // scrape mep information from the site
        const mepsFetched = [];
        linkItems.each((i, elem) => {
            const name = $(elem).find('a').text();
            const party = $(elem).find('div.description').text();
            mepsFetched[i] = { name: name, party: party, screen_name: null };
        });
        //const updatedMeps = mepsFetched;
        //const newMeps = mepsFetched;

        // download the previously collected data from Storage
        const oldMepsFile = await downloadFile(bucket.file('meps.json')); // how to handle if he file doesn't exist?
        fs.writeFile('meps_old.json', oldMepsFile, (err) => {
            if (err) throw err;
            console.log('meps_old.json file created');
        });

        // read into json
        const mepsOld = await fsPromises.readFile('meps_old.json', 'utf8');
        const mepsOldJson = JSON.parse(mepsOld);

        // compare the scraped data to the data already in storage
        const newMeps = mepsFetched.filter(mep => {
            return !includesMep(mep, mepsOldJson);
            //return mepsOld.includes(mep);
        });

        console.log(newMeps.length + ' new meps found.');
        if (newMeps.length > 0) { console.log(newMeps) };

        // add new meps to the json
        const updatedMeps = mepsOldJson.concat(newMeps);

        /*
        TODO here: fetch twitter usernames from the twitter list and add to the json
        */

        // Get all the Twitter user names to fetch
        const listMembers = await fetchMembers({ list_id: keListId, count: 300 });
        const memberScreenNames = listMembers.users.map(member => { return { screen_name: member.screen_name, name: member.name } });
        console.log(memberScreenNames[0]);pokpok

                /*
        TODO here: add the screen names to the meps json
        */

        // upload updated json to Storage
        if (updatedMeps.length >= 200) {
            if (newMeps.length > 0) {
                // write to json file
                fs.writeFile('meps.json', JSON.stringify(updatedMeps, null, 2), (err) => {
                    if (err) throw err;
                    console.log('meps.json file created');
                });

                // upload to storage
                bucket.upload('meps.json').then(function() {
                    console.log('data uploaded to storage');
                    //console.log(file);
                });
            } else {
                console.log('No new meps found. Aborting upload.');
            }

        } else {
            console.log('Something wrong with the meps json. Aborting upload.');
        }
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

getMeps();