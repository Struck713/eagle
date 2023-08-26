/*
 * Copyright (c) 2021 ILEFA Labs
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import axios from 'axios';
import cheerio from 'cheerio';
import fs from 'fs';
import progress from 'progress';
import { ContentArea } from '..';
import { ContentAreaNames } from '..';

type Course = {
    name: string;
    catalogName: string;
    catalogNumber: string;
    prerequisites: string;
    attributes: CourseAttributes; 
    credits: number;
    grading: string;
    description: string;
}

type CoursePayload = {
    href: string;
    subject: string;
    number: string;
    name: string;
    attrib: string[];
}

type CourseAttributes = {
    lab: boolean;
    writing: boolean;
    quantitative: boolean;
    environmental: boolean;
    contentAreas: ContentArea[];
    graduate: boolean;
}

const DEFAULT_PREREQS = 'There are no prerequisites for this course.';
const DEFAULT_DESC = 'There is no description provided for this course.';
const TITLE_REGEX = /^([a-zA-Z]{2,4})\s(\d{0,5})\s+(.+)\n?\s+([\d-,]+)\s(?:Credit Hours?)/;

const generateCourseMappings = async () => {
    console.log('[*] Preparing to generate mappings..');
    let start = Date.now();
    let $ = await axios
        .get('https://catalog.kent.edu/coursesaz/')
        .then(res => res.data)
        .then(res => cheerio.load(res))
        .catch(_ => null);

    if (!$) return console.error('Failed to retrieve data from the web.');

    let courses: Course[] = [];
    let urls: string[] = $(".letternav-head").next("ul").children("li").map((_, val) => $(val).children("a").attr("href")).get();

    // skip length check (we cannot query that data on the fly)
    if (fs.existsSync('./courses.json')) {
        let date = Date.now()
        console.log(`[*] Existing mappings saved to [courses-${date}.json]`);
        fs.copyFileSync('./courses.json', `./courses-${date}.json`);
    }

    console.log(`[*] Ready to generate mappings for ${urls.length.toLocaleString()} course sections.`);
    let bar = new progress(':url [:bar] :rate/rps :etas (:current/:total) (:percent done)', {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: urls.length
    });

    let attributesGained = {};

    for (let i = 1; i < urls.length; i++) {
        let target = `https://catalog.kent.edu${urls[i]}`;
        let $: cheerio.Root = await axios
            .get(target)
            .then(res => res.data)
            .then(data => cheerio.load(data))
            .catch(_ => null);

        if (!$) continue;

        $(".courseblock").each((index, _) => {
            let block = $(_);

            let title = readTitle(block.children(".courseblocktitle").text());
            let description = block.children(".courseblockdesc").first();
            let attributes = readAttributes(description.nextAll(".courseblockdesc").get().map(_ => $(_).text()));
            
            if (!title || !description) {
                console.error("Could not parse:", block.children(".courseblocktitle").text());
                return;
            }

            //console.log(readContentAreas(attributes["Attributes"]))
            
            courses.push({
                name: title.subject + title.number,
                catalogName: title.name,
                catalogNumber: title.number,
                prerequisites: attributes["Prerequisite"] ?? DEFAULT_PREREQS,
                attributes: {
                    lab: false, //hasCompetency(row, 'CA3LAB'),
                    writing: false, //hasCompetency(row, 'COMPW'),
                    quantitative: false, //hasCompetency(row, 'COMPQ'),
                    environmental: false, //hasCompetency(row, 'COMPE'),
                    contentAreas: readContentAreas(attributes["Attributes"]),
                    graduate: parseInt(title.number) >= 50000
                },
                credits: title.credits,
                grading: attributes["Grade Mode"] ?? "Unavailable",
                description: description.text().trim() ?? DEFAULT_DESC,
            });
        });

        bar.tick({
            url: ((i + 1) >= urls.length)
                ? 'done'
                : urls[i + 1]
        });
    }

    fs.writeFileSync('./courses.json', JSON.stringify(courses.sort((a, b) => a.name.localeCompare(b.name)), null, 3));
    console.log(`\n[*] Finished generating mappings for ${courses.length} courses in ${getLatestTimeValue(Date.now() - start)}.`);
}

const readTitle = (title?: string) => {
    let groups = title.match(TITLE_REGEX);
    if (!title || !groups) return null;
    return {
        subject: groups[1],
        number: groups[2],
        name: groups[3]
            .replace(/\(\w+\)/g, "")
            .trim(),
        credits: parseInt(groups[4])
    };
}

const readAttributes = (attributes?: string[]) => {
   let map = {};
    for (let attrib of attributes) {
         let [ key, value ] = attrib.split(": ");
         map[key] = value.trim();
    }
    return map;
}

const readContentAreas = (attributes?: string) => {
    if (!attributes) return [];
    let entries = Object.entries(ContentAreaNames);
    return attributes.split(", ").map(area => {
        for (let [ key, value ] of entries) {
            if (value === area) return key;
        }
    }) as ContentArea[];
}

const hasCompetency = (row: CoursePayload, competency: string) =>
    row
        .attrib
        .some(attrib => attrib === competency.toUpperCase());

const getLatestTimeValue = (time: number) => {
    let sec = Math.trunc(time / 1000) % 60;
    let min = Math.trunc(time / 60000 % 60);
    let hrs = Math.trunc(time / 3600000 % 24);
    let days = Math.trunc(time / 86400000 % 30.4368);
    let mon = Math.trunc(time / 2.6297424E9 % 12.0);
    let yrs = Math.trunc(time / 3.15569088E10);

    let y = `${yrs}y`;
    let mo = `${mon}mo`;
    let d = `${days}d`;
    let h = `${hrs}h`;
    let m = `${min}m`;
    let s = `${sec}s`;

    let result = '';
    if (yrs !== 0) result += `${y}, `;
    if (mon !== 0) result += `${mo}, `;
    if (days !== 0) result += `${d}, `;
    if (hrs !== 0) result += `${h}, `;
    if (min !== 0) result += `${m}, `;
    
    result = result.substring(0, Math.max(0, result.length - 2));
    if ((yrs !== 0 || mon !== 0 || days !== 0 || min !== 0 || hrs !== 0) && sec !== 0) {
        result += ', ' + s;
    }

    if (yrs === 0 && mon === 0 && days === 0 && hrs === 0 && min === 0) {
        result += s;
    }

    return result.trim();
}

generateCourseMappings();