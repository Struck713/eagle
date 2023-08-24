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

import qs from 'qs';
import axios from 'axios';
import moment from 'moment';
import cheerio from 'cheerio';
import RmpIds from './rmpIds.json';
import similarity from 'string-similarity';
import CourseMappings from './courses.json';
import tableparse from 'cheerio-tableparser';

import { decode as decodeEntity } from 'html-entities';

export const COURSE_IDENTIFIER = /^[a-zA-Z]{2,4}\d{3,5}(Q|E|W)*$/;
export const SECTION_IDENTIFIER = /^(H|Z|W|N)*\d{2,3}(L|D|X)*$/;
export const COURSE_SEPARATOR = /-{342}/
export const SCHOOL_RMP_ID = "U2Nob29sLTQ4Mg==";

export type CompleteCoursePayload = {
    name: string;
    catalogName: string;
    catalogNumber: string;
    attributes: CourseAttributes;
    grading: string;
    credits: number;
    prerequisites: string;
    description: string;
    sections: SectionData[];
    professors: ProfessorData[];
}

export type CourseAttributes = {
    lab: boolean;
    writing: boolean;
    quantitative: boolean;
    environmental: boolean;
    contentAreas: ContentArea[];
}

export enum ContentArea {
    CA1 = 'CA1',
    CA2 = 'CA2',
    CA3 = 'CA3',
    CA4 = 'CA4',
    CA4INT = 'CA4INT'
}

export enum ContentAreaNames {
    CA1 = 'Arts and Humanities',
    CA2 = 'Social Sciences',
    CA3 = 'Science and Technology',
    CA4 = 'Diversity and Multiculturalism',
    CA4INT = 'Diversity and Multiculturalism (International)'
}

export enum GradingTypeNames {
    GRADED = 'Standard Letter',
    SATISFACTORY_UNSATISFACTORY = 'Satisfactory/Unsatisfactory',
    HONORS_CREDIT = 'Honors',
    REGISTERED = 'Registered'
}

export type CoursePayload = {
    name: string;
    grading: string;
    credits: string;
    prereqs: string;
    lastDataMarker: Date;
    description: string;
    sections: SectionData[];
    professors: ProfessorData[];
}

export type SectionPayload = {
    name: string;
    grading: string;
    credits: string;
    prereqs: string;
    lastDataMarker: Date;
    description: string;
    section: SectionData;
}

export type SectionData = {
    internal: {
        termCode: string;
        classNumber: string;
        classSection: string;
        sessionCode: string;
    }
    term: string;
    mode: string;
    campus: string;
    instructor: string;
    section: string;
    session: string;
    schedule: string;
    location: SectionLocationData[];
    enrollment: {
        max: number;
        current: number;
        waitlist?: number;
        full: boolean;
    }
    notes: string;
}

export type SectionLocationData = {
    name: string;
    url?: string;
}

export type ProfessorData = {
    name: string;
    sections: SectionData[];
    rmpIds: string[];
}

export type RateMyProfessorResponse = {
    name: string;
    rmpIds: string[];
}

export type RateMyProfessorReport = {
    name: string;
    average: number;
    ratings: number;
    takeAgain: number;
    difficulty: number;
    tags: string[];
}

export enum UConnService {
    AURORA = 'Aurora',
    EMAIL = 'Email',
    HUSKYCT = 'HuskyCT',
    KFS = 'KFS',
    NETID = 'NetID',
    NETWORK = 'Network',
    STUDENT_ADMIN = 'Student Admin',
    WEBEX = 'Webex',
    UNKNOWN = 'Unknown'
}

export enum UConnServiceStatus {
    OPERATIONAL = 'Operational',
    REPORTING = 'Reporting',
    DEGRADED = 'Degraded',
    OUTAGE = 'Outage',
    UNKNOWN = 'Unknown'
}

export type UConnServiceReport = {
    service: UConnService;
    status: UConnServiceStatus;
    time: number;
}

export type Classroom = {
    name: string;
    building: {
        name: string;
        code: string;
        campus: string;
    };
    room: string;
    techType: string;
    techDescription?: string;
    seatingType: keyof typeof SeatingType;
    boardType: keyof typeof BoardType;
    capacity: {
        covid: number;
        full: number;
    };
    byodTesting?: boolean;
    airConditioned?: boolean;
    videoConference: ClassroomConferenceType;
    lectureCapture: keyof typeof LectureCaptureType;
    liveStreamUrl?: string;
    threeSixtyView: string;
}

export type ConferenceTypeCapabilities = {
    shareContent: boolean;
    instructorFacingCamera: boolean;
    studentFacingCamera: boolean;
    presentMediaFrontOfRoom: boolean;
    presentMediaBackOfRoom: boolean;
    instructorMicrophone: boolean;
    studentMicrophone: boolean;
    connectToWebex: boolean;
}

export class ClassroomConferenceType {

    static readonly FULL = new ClassroomConferenceType('FULL', 'Full Video Conference', {
        shareContent: true,
        instructorFacingCamera: true,
        studentFacingCamera: true,
        presentMediaFrontOfRoom: true,
        presentMediaBackOfRoom: true,
        instructorMicrophone: true,
        studentMicrophone: true,
        connectToWebex: true
    });
    
    static readonly TEACH_FROM = new ClassroomConferenceType('TEACH_FROM', 'Teach From Video Conference', {
        shareContent: true,
        instructorFacingCamera: true,
        studentFacingCamera: false,
        presentMediaFrontOfRoom: false,
        presentMediaBackOfRoom: true,
        instructorMicrophone: true,
        studentMicrophone: false,
        connectToWebex: true    
    });
    
    static readonly SEMINAR = new ClassroomConferenceType('SEMINAR', 'Seminar Video Conference', {
        shareContent: true,
        instructorFacingCamera: true,
        studentFacingCamera: false,
        presentMediaFrontOfRoom: true,
        presentMediaBackOfRoom: false,
        instructorMicrophone: true,
        studentMicrophone: true,
        connectToWebex: true
    });
    
    static readonly NONE = new ClassroomConferenceType('NONE', 'None', {
        shareContent: false,
        instructorFacingCamera: false,
        studentFacingCamera: false,
        presentMediaFrontOfRoom: false,
        presentMediaBackOfRoom: false,
        instructorMicrophone: false,
        studentMicrophone: false,
        connectToWebex: false
    });

    private constructor(private readonly key: string, public readonly name: string, public readonly attributes: ConferenceTypeCapabilities) {}

    static fromString = (input: string) => {
        let valid = ['FULL', 'TEACH_FROM', 'SEMINAR'];
        if (valid.some(v => input.toLowerCase() === v))
            return ClassroomConferenceType[input.toUpperCase()];

        return valid
            .map(v => ClassroomConferenceType[v])
            .map(ent => {
                let k = ent as ClassroomConferenceType;
                if (k.name.toLowerCase() === input.toLowerCase())
                    return k;
            })
            .filter(ent => !!ent)
            .map(({ name, attributes }) => ({ name, attributes }))[0];
    }

    toString = () => this.key;

}

export enum SeatingType {
    TABLES = 'Tables',
    TABLES_AND_ARMCHAIRS = 'Tables and Tablet Armchairs',
    TABLET_ARMCHAIRS = 'Tablet Armchairs',
    FIXED_AUDITORIUM = 'Fixed/Auditorium',
    FIXED_TABLES = 'Fixed Seating Tables',
    FIXED_LEVELED_TABLES = 'Fixed Tier Leveled Tables',
    LAB_TABLES = 'Lab Tables and Chairs',
    ACTIVE = 'Active Learning',
    UNKNOWN = 'Unknown'
}

export enum TechType {
    FULL = 'Full Hi-Tech',
    BASIC = 'Basic Hi-Tech',
    UNKNOWN = 'Unknown',
}

export enum BoardType {
    NONE = 'None',
    WHITEBOARD = 'Whiteboard',
    CHALKBOARD = 'Chalkboard',
    UNKNOWN = 'Unknown'
}

export enum LectureCaptureType {
    ALL = 'All',
    NONE = 'None',
    SELF_SERVICE_RECORDING = 'Self Service Recording'
}

export enum BuildingCode {
    AFC = "FedEx Aeronautics Academic Center",
    AAC = "Allerton Sports Complex",
    AIR = "Airport Hangar/Office Bldg.", 
    ALN = "Allyn Hall",
    ANX = "M.A.C.C. Annex",
    ASB = "Administrative Service Building",
    ATB = "Aeronautics and Engineering Building",
    BEA = "Twin Towers Center",
    BEL = "Beall Hall",
    BOW = "Bowman Hall",
    BSA = "Business Administration Building",
    BST = "Baseball and Softball Training Facility",
    CAE = "Center for Architecture and Environmental Design",
    CBH = "Golf Course Clubhouse",
    CCA = "Centennial Court A",
    CCB = "Centennial Court B",
    CCC = "Centennial Court C",
    CCD = "Centennial Court D",
    CCE = "Centennial Court E",
    CCF = "Centennial Court F",
    CDC = "Child Development Center",
    CHH = "Cunningham Hall and Research Wing",
    CHA = "Cunningham Hall and Research Wing",
    CLK = "Clark Hall",
    CPA = "Center for the Performing Arts",
    CPM = "College of Podiatric Medicine",
    CUD = "Cleveland Urban Design Collaborative",
    CUE = "Center for Undergraduate Excellence", 
    CVA = "Center for the Visual Arts",
    CWH = "Cartwright Hall",
    CWP = "East Campus Chilled Water Plant",
    DHC = "DeWeese Health Center",
    DIH = "Design Innovation Hub",
    DIX = "Dix Stadium",
    DSB = "Dix Storage Building",
    DTB = "Centennial Research Park",
    DUN = "Dunbar Hall",
    ENG = "Engleman Hall",
    EWC = "Eastway Center",
    FBC = "Flight Briefing Center",
    FLD = "Field House",
    FLR = "Fletcher Hall",
    FRH = "Franklin Hall",
    FRA = "Franklin Hall Addition",
    GCM = "Golf Course Maintenance Building",
    GHA = "Kappa Sigma",
    GST = "Guest House",
    GTC = "Golf Training Center",
    HAR = "Harbourt Hall",
    HDN = "Henderson Hall",
    HRH = "Heer Hall",
    IAB = "Center for Philanthropy and Alumni Engagement",
    ICA = "Ice Arena", 
    ISB = "Integrated Sciences Building",
    JHN = "Johnson Hall", 
    KBC = "WKSU Broadcast Center", 
    KOO = "Koonce Hall", 
    KOR = "Korb Hall", 
    KTH = "Kent Hall and South Wing",
    KTA = "Kent Hall and South Wing",
    LAK = "Lake Hall",
    LCM = "Liquid Crystals Materials Science Building", 
    LEE = "Leebrick Hall",
    LIB = "Library", 
    LNB = "Lincoln Building",
    LRH = "Lowry Hall",
    MAC = "Memorial Athletic and Convocation Center",
    MAN = "Manchester Hall", 
    MCD = "McDowell Hall", 
    MCG = "McGilvrey Hall",
    MLH = "Merrill Hall", 
    MOU = "Moulton Hall", 
    MPH = "May Prentice House", 
    MSB = "Mathematical Sciences Building",
    MSC = "Schwartz Center",
    MST = "Maintenance Storage Building",
    NXH = "Nixson Hall", 
    OBS = "Observatory", 
    OLS = "Olson Hall",
    ORH = "Oscar Ritchie Hall", 
    PRN = "Prentice Hall", 
    RHS = "Summit Street Warehouse", 
    ROC = "Rockwell Hall",
    RSO = "Research One Building", 
    CHG = "Research Greenhouse", 
    SAF = "Maintenance Building 55",
    SFH = "Satterfield Hall",
    SMH = "Smith Hall", 
    SPP = "Summit Street Power Plant",
    SPA = "Summit Street Power Plant West Wing",
    SRB = "Science Research Building",
    SRC = "Student Recreation and Wellness Center",
    SRP = "Student Recreation Field Pavilion",
    STB = "Stockdale Building",
    STC = "Student Center",
    STH = "Stewart Hall",
    STO = "Stopher Hall",
    SUB = "Substation",
    TER = "Terrace Hall",
    TLH = "Taylor Hall",
    TRT = "Tri Towers Rotunda",
    UFM = "University Facilities Management",
    UPH = "University President's House",
    VBF = "Varsity Baseball Clubhouse",
    VER = "Verder Hall",
    VNC = "Van Campen Hall",
    WAC = "Williamson House",
    WMH = "Williams Hall",
    WRT = "Wright Hall",
    WTH = "White Hall",
    ZZR = "Starbucks Building",
    ZZS = "Cutler Building"
}

export type CampusType = 'any' 
                | 'kent' 
                | 'east_liverpool' 
                | 'trumbull' 
                | 'tuscarawas' 
                | 'stark'
                | 'geauga'
                | 'ashtabula'
                | 'salem';

export enum SearchParts {
    SECTIONS,
    PROFESSORS
}

export type EnrollmentPayload = {
    course: {
        term: string;
        classNumber: string;
        section: string;
    };
    available: number;
    total: number;
    overfill: boolean;
    percent: number;
}

export enum RmpCampusIds {
    KENT = 'U2Nob29sLTQ4Mg==',
    EAST_LIVERPOOL = 'U2Nob29sLTIzMTA=',
    TRUMBULL = 'U2Nob29sLTIzMTI=',
    TUSCARAWAS = 'U2Nob29sLTIzMTM=',
    STARK = 'U2Nob29sLTQyNjg=',
    GEAUGA = 'U2Nob29sLTUyMDg=',
    ASHTABULA = 'U2Nob29sLTIzMTA=',
    SALEM = 'U2Nob29sLTIzMTE='

}

const DEFAULT_PREREQS = 'There are no prerequisites for this course.';
const DEFAULT_DESC = 'There is no description provided for this course.';
const DEFAULT_SEARCH_PARTS = [SearchParts.SECTIONS, SearchParts.PROFESSORS];
const TERM = "202380";

const getCatalogUrl = async (prefix: string, number: string) => await axios.
    get(`https://keys.kent.edu/ePROD/bwckctlg.p_display_courses?term_in=202380&one_subj=${prefix}&sel_crse_strt=${number}&sel_crse_end=${number}&sel_subj=&sel_levl=&sel_schd=&sel_coll=&sel_divs=&sel_dept=&sel_attr=`)
    .then(res => res.data)
    .catch(_ => null);

const getCatalogSections = async (prefix: string, number: string) => await axios
    .post('https://keys.kent.edu/ePROD/bwlkffcs.P_AdvUnsecureGetCrse', 
        qs.stringify({
            term_in: TERM,
            sel_subj: "dummy",
            sel_day: "dummy",
            sel_schd: "dummy",
            sel_insm: "dummy",
            sel_loc: "dummy",
            sel_levl: "dummy",
            sel_sess: "dummy",
            sel_instr: "dummy",
            sel_ptrm: "dummy",
            sel_attr: "dummy",
            sel_camp: "dummy"
        }) + "&" + 
        qs.stringify({
            sel_subj: prefix,
            sel_crse: number,
            sel_title: "",
            sel_camp: "%",
            sel_insm: "%",
            sel_from_cred: "",
            sel_to_cred: "",
            sel_loc: "%",
            sel_levl: "%",
            sel_ptrm: "%",
            sel_instr: "%",
            sel_attr: "%",
            begin_hh: 0,
            begin_mi: 0,
            begin_ap: "a",
            end_hh: 0,
            end_mi: 0,
            end_ap: "a",
        })
    ).then(res => res.data)
    .catch(_ => null);

/**
 * Attempts to retrieve data regarding
 * a specific UConn course, and returns
 * all sections, metadata, and other related
 * data about it.
 * 
 * Using ``useMappings`` as true will only return
 * the base course information, and will always
 * omit professors and sections from the result.
 * 
 * Do note that if the mapping does not exist,
 * it will fallback to querying the catalog.
 * 
 * Also do note that {@link SearchParts.PROFESSORS} is contingent
 * upon {@link SearchParts.SECTIONS} being included, so if it is
 * not, you will not get professors data.
 * 
 * @param identifier a valid course identifier
 * @param campus a valid campus type
 * @param useMappings whether or not to use offline mappings first, and if not found then query catalog
 * @param include overrides what parts are included in the CoursePayload, omit parameter to include all parts
 */
export const searchCourse = async (identifier: string, campus: CampusType = 'any', useMappings: boolean = false, include: SearchParts[] = DEFAULT_SEARCH_PARTS): Promise<CoursePayload> => {
    if (!COURSE_IDENTIFIER.test(identifier)) return null;
    
    let prefix = identifier.split(/[0-9]/)[0].toUpperCase();
    let number = identifier.split(/[a-zA-Z]{2,4}/)[1];

    if (useMappings) {
        let mapping = (CourseMappings as any).find(ent => ent.name === identifier);
        if (!mapping) return await searchCourse(identifier, campus, false, []);
        let marker = moment().isBefore(new Date().setHours(6))
            ? moment(new Date().setHours(-6))
            : moment(new Date().setHours(0));

        return {
            name: mapping.name,
            grading: mapping.grading,
            credits: mapping.credits.toString(),
            prereqs: mapping.prerequisites,
            lastDataMarker: marker.toDate(),
            description: mapping.description,
            sections: [],
            professors: []
        }
    }

    let catalogData = await getCatalogUrl(prefix, number);
    if (!catalogData) return null;

    let $ = cheerio.load(catalogData);
    
    let titleRaw = $(".nttitle").text().split(" - ");
    let name = titleRaw[1];

    let classDataRaw = $(".ntdefault").text().split(/\n{1,}/);
    let grading = GradingTypeNames.GRADED;
    let credits = (classDataRaw[2] || "0")
        .replace(/[a-zA-Z]+/g, "")
        .trim();
    let lastDataMarker = new Date();

    let descriptionRaw = classDataRaw[1].split(" Prerequisite: ");
    let description = descriptionRaw[0] || DEFAULT_DESC;

    let prereqs = descriptionRaw[1] || DEFAULT_PREREQS;
    if (prereqs.includes('None.')) prereqs = DEFAULT_PREREQS;

    if (!include.includes(SearchParts.SECTIONS))
        return {
            name, grading, credits,
            prereqs, lastDataMarker,
            description,
            sections: [],
            professors: []
        };

    
    let sectionDataTable = await getCatalogSections(prefix, number);
    let $section = cheerio.load(sectionDataTable);
    tableparse($section);

    let table = ($section('table.datadisplaytable') as any).parsetable(true, false, true);
    let sections: SectionData[] = [];

    let sectionCount = table[0].filter(x => x.match(COURSE_SEPARATOR)).length;
    let lastSectionSeparator = 1;
    for (let i = 0; i < sectionCount; i++) {
        /**
         * 0: status
         * 1: text book
         * 2: fees
         * 3: CRN
         * 4: identifier - course # - section #
         * 5: credits
         * 6: title
         * 7: attributes
         * 8: enrollment
         * 9: remain open
         * 10: lecture type
         * 11: meeting dates
         * 12: days (week)
         * 13: times
         * 14: method of instruction
         * 15: location
         * 16: instructor
         * 17: need special approval?
         * 18: prerequisites
         * 19: registration deadlines
         * 20: campus
         * 21: other
         */
        let tableIndex = lastSectionSeparator + 1;
        let campus = table[20][tableIndex];
        let instructor = table[16][tableIndex]
            .replace(/\(.+\)/, "")
            .replace(/\s{2,}/g, " ")
            .trim();
        let schedule = table[12][tableIndex] + " " + table[13][tableIndex];
        let enrollment = Number(table[8][tableIndex]);
        let remainOpen = Number(table[9][tableIndex]);

        let identifierRaw = table[4][tableIndex].split(" - ");
        let sessionCode = table[3][tableIndex];
        let classNumber = identifierRaw[0] + identifierRaw[1];
        let classSection = identifierRaw[2];

        sections.push({
            mode: "",
            campus,
            enrollment: {
                current: enrollment,
                max: enrollment + remainOpen,
                full: remainOpen == 0
            },
            instructor,
            notes: table[21][tableIndex],
            schedule,
            section: classSection,
            session: sessionCode,
            term: "",
            internal: {
                classNumber,
                classSection,
                sessionCode,
                termCode: ""
            },
            location: []
        });
        lastSectionSeparator = table[0].findIndex((e, i) => e.match(COURSE_SEPARATOR) && i > lastSectionSeparator);
    }

    if (campus !== 'any') {
        sections = sections.filter(section => 
            section
                .campus
                .replace(' ', '_')
                .toLowerCase() === campus.toLowerCase());
        sectionCount = sections.length;
    }
    
    if (!include.includes(SearchParts.PROFESSORS))
        return {
            name, grading, credits,
            prereqs, lastDataMarker,
            description, sections,
            professors: []
        }

    let professors: ProfessorData[] = [];
    for (let section of sections) {
        
        let prof = section.instructor;
        if (professors.some(p => p.name === prof))
            continue;
    
        let rmp = await searchRMP(prof);
        let teaching = sections
                .filter(section => section.instructor === prof)
                .sort((a, b) => a.section.localeCompare(b.section));

        professors.push({
            name: section.instructor,
            sections: teaching,
            rmpIds: rmp ? rmp.rmpIds : []
        });
    }

    return {
        name, grading, credits,
        prereqs, lastDataMarker,
        description, sections,
        professors
    }
}

/**
 * Attempts to retrieve information about
 * the given section of a course in the form
 * of a SectionData object.
 * 
 * @param identifier the course identifier
 * @param section the course section to query
 */
export const searchBySection = async (identifier: string, section: string): Promise<SectionPayload> => {
    let res = await searchCourse(identifier, detectCampusBySection(section) || 'any');
    if (!res)
        return null;

    let data = res
        .sections
        .find(({ section: sec }) => sec.toLowerCase() === section.toLowerCase());

    if (!data)
        return null;

    return {
        name: res.name,
        grading: res.grading,
        credits: res.credits,
        prereqs: res.prereqs,
        lastDataMarker: res.lastDataMarker,
        description: res.description,
        section: data
    }
}

/**
 * Attempts to locate entries on RMP
 * for a specified professor.
 * 
 * @param instructor the instructor to search for
 */
export const searchRMP = async (instructor: string): Promise<RateMyProfessorResponse> => {
    let local = RmpIds.find(ent => ent.name.toLowerCase() === instructor.toLowerCase());
    if (local) return {
        name: instructor,
        rmpIds: local.rmpIds
    }

    let similar = RmpIds
        .map(entry => ({ ...entry, similarity: similarity.compareTwoStrings(instructor, entry.name) }))
        .sort((a, b) => b.similarity - a.similarity)
        .filter(entry => entry.similarity > 0.70);

    if (similar.length) return {
        name: similar[0].name,
        rmpIds: similar[0].rmpIds  
    }

    if (!instructor.trim() || instructor.split(',').length)
        return null;

    let res = await axios.post(`https://www.ratemyprofessors.com/graphql`, 
        {
            query: `
                query NewSearch {
                    newSearch {
                        teachers(query: {text: "${instructor}", schoolID: "${SCHOOL_RMP_ID}"}) {
                            resultCount
                            edges {
                                node {
                                    id
                                }
                            }
                        }
                    }
                }
            `
        },
        {
            headers: {
                "Authorization": "Basic dGVzdDp0ZXN0"
            }
        }
    ).then(res => res.data).catch(_ => null);

    if (!res) return {
        name: instructor,
        rmpIds: []
    }

    let rmp: string[] = res.data.newSearch.teachers.edges.map(e => e.node.id);
    return {
        name: instructor,
        rmpIds: rmp
    }
}

/**
 * Attempts to create a report based
 * off of RMP data available for a
 * specified professor's RMP ID.
 * 
 * @param id the instructor's ratemyprofessors' id
 */
export const getRmpReport = async (id: string): Promise<RateMyProfessorReport> => {
    let res = await axios.post(`https://www.ratemyprofessors.com/graphql`, 
        {
            query: `
                query Node {
                    node(id: "${id}") {
                        ... on Teacher {
                            avgRating
                            avgDifficultyRounded
                            wouldTakeAgainPercent
                            numRatings
                            teacherRatingTags {
                                tagName
                            }
                            firstName
                            lastName
                        }
                    }
                }
            `
        },
        {
            headers: {
                "Authorization": "Basic dGVzdDp0ZXN0"
            }
        }
    ).then(res => res.data).catch(_ => null);

    if (!res) return null;

    let node = res.data.node;
    return {
        name: node.firstName + " " + node.lastName,
        average: node.avgRating,
        difficulty: node.avgDifficultyRounded,
        ratings: node.numRatings,
        takeAgain: node.wouldTakeAgainPercent,
        tags: node.teacherRatingTags.map(ent => ent.tagName)
    };
}

/**
 * Attempts to guess what campus a certain
 * section is being taught at.
 * 
 * Notice: This method will not always work,
 * as off-campus courses and Storrs courses
 * both do not have alphabetic prefixes, and
 * just start with a the section number.
 * 
 * @param section the section name
 */
export const detectCampusBySection = (section: string): CampusType => {
    // switch (section.substring(0, 2).toLowerCase()) {
    //     case 'ke':
    //         return 'kent';
    //     case 'ea':
    //         return 'stamford';
    //     case 't':
    //         return 'waterbury';
    //     case 'n':
    //         return 'avery_point';
    //     default:
    //         return 'storrs';
    // }
    return 'any';
}

/**w
 * Returns whether or not the provided campus
 * is a valid member of the {@link CampusType} type.
 * 
 * @param input the inputted campus
 */
export const isCampusType = (input: string): input is CampusType => {
    let lower = input.toLowerCase();
    return lower == 'any'
        || lower == 'kent'
        || lower == 'east_liverpool'
        || lower == 'trumbull'
        || lower == 'tuscuwaras'
        || lower == 'stark'
        || lower == 'guaga'
        || lower == 'ashtabula'
        || lower == 'salem';
}

/**
 * Attempts to query enrollment data from the
 * course catalog enrollment API.
 * 
 * Returns an unformatted string of #/# which
 * represents the current available seats and
 * capacity of the requested class.
 * 
 * @param term the term id of the current term
 * @param classNumber the class number for the requested class
 * @param section the requested section
 */
export const getRawEnrollment = async (term: string, classNumber: string, section: string): Promise<EnrollmentPayload> => await axios
    .post('https://keys.kent.edu/ePROD/bwlkffcs.P_AdvUnsecureGetCrse', 
        qs.stringify({
            sel_subj: "dummy",
            sel_day: "dummy",
            sel_schd: "dummy",
            sel_insm: "dummy",
            sel_loc: "dummy",
            sel_levl: "dummy",
            sel_sess: "dummy",
            sel_instr: "dummy",
            sel_ptrm: "dummy",
            sel_attr: "dummy",
            sel_camp: "dummy"
        }) + "&" + 
        qs.stringify({
            term_in: term,
            sel_subj: section,
            sel_crse: classNumber,
            sel_title: "",
            sel_camp: "%",
            sel_insm: "%",
            sel_from_cred: "",
            sel_to_cred: "",
            sel_loc: "",
            sel_levl: "%",
            sel_ptrm: "%",
            sel_instr: "%",
            sel_attr: "%",
            begin_hh: 0,
            begin_mi: 0,
            begin_ap: "a",
            end_hh: 0,
            end_mi: 0,
            end_ap: "a",
        })
    )
    .then(res => res.data)
    .then(async res => {
        // if (!res.success)
        //     throw new Error('Request failed');

        // let seats: string[] = res.data.split('/');
        // let available = parseInt(seats[0]);
        // let total = parseInt(seats[1]);
        // let overfill = available >= total;

        // return {
        //     course: {
        //         term,
        //         section,
        //         classNumber
        //     },
        //     available,
        //     total,
        //     overfill,
        //     percent: Number((available / total).toFixed(2))
        // }
        console.log(res);
    })
    .catch(_ => null);

const replaceAll = (input: string, search: string, replace: string) => {
    let copy = String(input);
    if (!copy.includes(search)) {
        return copy;
    }

    while (copy.includes(search)) {
        copy = copy.replace(search, replace);
    }

    return copy;
}
    