import axios from "axios";
import fs from "fs";
import progress from "progress";
import { Professor } from "../index";

/**
 * 
 * This function will dump the ActionDirectorySearch endpoint using a provided CSRF token and cookies.
 * This was the only way I found that I could query all of the professors easily, as professor email data
 * from Kent State is not publicly avaliable.
 * 
 * @param csrf Your Flashline CSRF token
 * @param cookies Your Flashline cookies
 * @returns
 */
export const generateProfessorMappings = async (csrf: string, cookies: string) => {

    let start = Date.now();
    if (fs.existsSync('./professors.json')) {
        let date = Date.now()
        console.log(`[*] Existing professors saved to [professors-${date}.json]`);
        fs.copyFileSync('./professors.json', `./professors-${date}.json`);
    }

    console.log("[*] Requesting all professors from endpoint.. (this might take awhile)")
    const data = await axios.post("https://apps.kent.edu/KSUMobile/screenservices/KSUMobile/Apps/Directory/ActionDirectorySearch", {
        versionInfo: {
            moduleVersion: "qSGya2oEL_crBb4jyXs0TA",
            apiVersion: "4rxgMHyB_gFHd5GthKgvFw"
        },
        viewName: "Apps.Directory",
        inputParameters: {
            InputSearchText: "", // nothing LOL
            IsEmployee: true,
            IsStudent: false
        }
    },
    {
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json; charset=UTF-8",
            "Sec-Ch-Ua": "\"Chromium\";v=\"116\", \"Not)A;Brand\";v=\"24\", \"Brave\";v=\"116\"",
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": "\"Windows\"",
            "X-Csrftoken": csrf,
            "Referer": "https://apps.kent.edu/KSUMobile/Directory",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Cookie": cookies,
        }
    }).then(res => res.data)
      .then(data => data.data.DirectoryResultsList.List)
      .catch(_ => null);

    if (!data) return console.error("[*] Failed to retrieve all of the professors from the endpoint.");

    let professors: Professor[] = [];
    let bar = new progress(':prof [:bar] :rate/rps :etas (:current/:total) (:percent done)', {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: data.length
    });

    for (let i = 0; i < data.length; i++) {
        let professor = data[i];
        
        if (professors.find(e => e.email === professor.Email)) continue;
        professors.push({
            name: professor.PreferredFirstName + " " + professor.LastName,
            email: professor.Email,
        });

        bar.tick({
            prof: ((i + 1) >= professors.length)
                ? 'done'
                : professors[i + 1]
        });
    }

    fs.writeFileSync('./professors.json', JSON.stringify(professors.sort((a, b) => a.name.localeCompare(b.name)), null, 3));
    console.log(`\n[*] Finished generating mappings for ${professors.length} professors in ${getLatestTimeValue(Date.now() - start)}.`);
    
}

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

generateProfessorMappings("", "")