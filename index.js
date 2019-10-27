const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucket = storage.bucket('mep-details');

const fs = require('fs');
const fsPromises = require("fs").promises;

const cheerio = require('cheerio')
const axios = require("axios");

const siteUrl = "https://www.eduskunta.fi/FI/kansanedustajat/Sivut/Kansanedustajat-aakkosjarjestyksessa.aspx";

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
            mepsFetched[i] = { name: name, party: party };
        });

        // download the previously collected data from Storage
        const oldMepsFile = await downloadFile(bucket.file('meps.json'));

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
        if (newMeps.length > 0) {console.log(newMeps)};

        // add new meps to the json
        const updatedMeps = mepsOldJson.concat(newMeps);

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

    }
}
// https://levelup.gitconnected.com/web-scraping-with-node-js-c93dcf76fe2b
getMeps();


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