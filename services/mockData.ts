import { SongData, RankingHistory } from '../types';

// Helper to create semi-random ranking history
// avgRank: The target average position
// volatility: How much it jumps up/down
// startYear: Year it entered (null before that)
const genHistory = (avgRank: number, volatility: number = 20, startYear: number = 1999): RankingHistory => {
    const h: RankingHistory = {};
    for (let y = 1999; y <= 2023; y++) {
        if (y < startYear) {
            h[y.toString()] = null;
        } else {
            // Generate random fluctuation around the average
            const noise = Math.floor(Math.random() * (volatility * 2 + 1)) - volatility;
            let r = avgRank + noise;
            // Clamp between 1 and 2000
            r = Math.max(1, Math.min(2000, r));
            h[y.toString()] = r;
        }
    }
    return h;
};

export const rawSongData: SongData[] = [
    // --- TOP 10 TITANS (Hardcoded for authentic feel) ---
    {
        id: 'queen-bohemian',
        artist: 'Queen',
        title: 'Bohemian Rhapsody',
        releaseYear: 1975,
        rankings: {
          '1999': 1, '2000': 1, '2001': 1, '2002': 1, '2003': 1, '2004': 1, '2005': 2, '2006': 1, '2007': 1, '2008': 1, '2009': 1,
          '2010': 2, '2011': 1, '2012': 1, '2013': 1, '2014': 2, '2015': 2, '2016': 1, '2017': 1, '2018': 1, '2019': 1, '2020': 2, '2021': 1, '2022': 1, '2023': 1
        }
    },
    {
        id: 'eagles-hotel',
        artist: 'Eagles',
        title: 'Hotel California',
        releaseYear: 1977,
        rankings: {
          '1999': 2, '2000': 4, '2001': 3, '2002': 3, '2003': 2, '2004': 2, '2005': 3, '2006': 3, '2007': 3, '2008': 2, '2009': 2,
          '2010': 1, '2011': 2, '2012': 2, '2013': 2, '2014': 1, '2015': 3, '2016': 2, '2017': 2, '2018': 2, '2019': 2, '2020': 3, '2021': 4, '2022': 3, '2023': 3
        }
    },
    {
        id: 'billy-piano',
        artist: 'Billy Joel',
        title: 'Piano Man',
        releaseYear: 1974,
        rankings: {
          '1999': 3, '2000': 121, '2001': 83, '2002': 57, '2003': 58, '2004': 60, '2005': 66, '2006': 49, '2007': 54, '2008': 34, '2009': 50,
          '2010': 45, '2011': 45, '2012': 29, '2013': 36, '2014': 18, '2015': 7, '2016': 6, '2017': 4, '2018': 4, '2019': 3, '2020': 3, '2021': 4, '2022': 5, '2023': 4
        }
    },
    {
        id: 'deep-child',
        artist: 'Deep Purple',
        title: 'Child in Time',
        releaseYear: 1970,
        rankings: {
            '1999': 4, '2000': 2, '2001': 2, '2002': 2, '2003': 3, '2004': 3, '2005': 4, '2006': 4, '2007': 4, '2008': 3, '2009': 4,
            '2010': 5, '2011': 4, '2012': 3, '2013': 4, '2014': 4, '2015': 4, '2016': 4, '2017': 5, '2018': 6, '2019': 6, '2020': 7, '2021': 9, '2022': 12, '2023': 11
        }
    },
    {
        id: 'led-stairway',
        artist: 'Led Zeppelin',
        title: 'Stairway to Heaven',
        releaseYear: 1971,
        rankings: {
          '1999': 3, '2000': 4, '2001': 3, '2002': 4, '2003': 4, '2004': 4, '2005': 4, '2006': 5, '2007': 5, '2008': 5, '2009': 5,
          '2010': 4, '2011': 5, '2012': 5, '2013': 3, '2014': 3, '2015': 3, '2016': 5, '2017': 3, '2018': 3, '2019': 4, '2020': 5, '2021': 5, '2022': 7, '2023': 6
        }
    },
    {
        id: 'meatloaf-paradise',
        artist: 'Meat Loaf',
        title: 'Paradise by the Dashboard Light',
        releaseYear: 1978,
        rankings: genHistory(8, 5)
    },
    {
        id: 'boudewijn-avond',
        artist: 'Boudewijn de Groot',
        title: 'Avond',
        releaseYear: 1997,
        rankings: {
          '1999': 1, '2000': 428, '2001': 121, '2002': 41, '2003': 25, '2004': 8, '2005': 5, '2006': 1, '2007': 2, '2008': 2, '2009': 3,
          '2010': 3, '2011': 3, '2012': 4, '2013': 5, '2014': 5, '2015': 5, '2016': 7, '2017': 6, '2018': 9, '2019': 10, '2020': 6, '2021': 7, '2022': 10, '2023': 8
        }
    },
    {
        id: 'pink-wish',
        artist: 'Pink Floyd',
        title: 'Wish You Were Here',
        releaseYear: 1975,
        rankings: genHistory(12, 5)
    },
    {
        id: 'pearl-black',
        artist: 'Pearl Jam',
        title: 'Black',
        releaseYear: 1991,
        rankings: genHistory(15, 8)
    },
    {
        id: 'coldplay-fix',
        artist: 'Coldplay',
        title: 'Fix You',
        releaseYear: 2005,
        rankings: genHistory(15, 10, 2005)
    },

    // --- OTHER CLASSICS (Generated Rankings) ---
    {
        id: 'metallica-nothing',
        artist: 'Metallica',
        title: 'Nothing Else Matters',
        releaseYear: 1991,
        rankings: genHistory(20, 10)
    },
    {
        id: 'toto-africa',
        artist: 'Toto',
        title: 'Africa',
        releaseYear: 1982,
        rankings: genHistory(25, 10)
    },
    {
        id: 'cure-forest',
        artist: 'The Cure',
        title: 'A Forest',
        releaseYear: 1980,
        rankings: genHistory(30, 15)
    },
    {
        id: 'u2-one',
        artist: 'U2',
        title: 'One',
        releaseYear: 1991,
        rankings: genHistory(35, 10)
    },
    {
        id: 'gnr-november',
        artist: 'Guns N\' Roses',
        title: 'November Rain',
        releaseYear: 1992,
        rankings: genHistory(15, 5)
    },
    {
        id: 'prince-purple',
        artist: 'Prince',
        title: 'Purple Rain',
        releaseYear: 1984,
        rankings: genHistory(20, 10)
    },
    {
        id: 'bowie-heroes',
        artist: 'David Bowie',
        title: 'Heroes',
        releaseYear: 1977,
        rankings: genHistory(30, 15)
    },
    {
        id: 'queen-love',
        artist: 'Queen',
        title: 'Love of My Life',
        releaseYear: 1975,
        rankings: genHistory(40, 20)
    },
    {
        id: 'disturbed-sound',
        artist: 'Disturbed',
        title: 'The Sound of Silence',
        releaseYear: 2016,
        rankings: genHistory(30, 15, 2016)
    },
    {
        id: 'danny-roller',
        artist: 'Danny Vera',
        title: 'Roller Coaster',
        releaseYear: 2019,
        rankings: genHistory(5, 2, 2019)
    },
    {
        id: 'aha-take',
        artist: 'a-ha',
        title: 'Take On Me',
        releaseYear: 1985,
        rankings: genHistory(80, 25)
    },
    {
        id: 'abba-dancing',
        artist: 'ABBA',
        title: 'Dancing Queen',
        releaseYear: 1976,
        rankings: genHistory(60, 20)
    },
    {
        id: 'mj-billie',
        artist: 'Michael Jackson',
        title: 'Billie Jean',
        releaseYear: 1983,
        rankings: genHistory(90, 30)
    },
    {
        id: 'fleetwood-chain',
        artist: 'Fleetwood Mac',
        title: 'The Chain',
        releaseYear: 1977,
        rankings: genHistory(70, 25)
    },
    {
        id: 'phil-air',
        artist: 'Phil Collins',
        title: 'In The Air Tonight',
        releaseYear: 1981,
        rankings: genHistory(50, 20)
    },
    {
        id: 'dire-brothers',
        artist: 'Dire Straits',
        title: 'Brothers in Arms',
        releaseYear: 1985,
        rankings: genHistory(45, 15)
    },
    {
        id: 'nirvana-smells',
        artist: 'Nirvana',
        title: 'Smells Like Teen Spirit',
        releaseYear: 1991,
        rankings: genHistory(55, 20)
    },
    {
        id: 'bruce-river',
        artist: 'Bruce Springsteen',
        title: 'The River',
        releaseYear: 1980,
        rankings: genHistory(65, 20)
    },
    {
        id: 'simon-bridge',
        artist: 'Simon & Garfunkel',
        title: 'Bridge Over Troubled Water',
        releaseYear: 1970,
        rankings: genHistory(75, 25)
    },
    {
        id: 'stones-paint',
        artist: 'The Rolling Stones',
        title: 'Paint It Black',
        releaseYear: 1966,
        rankings: genHistory(85, 25)
    },
    {
        id: 'acdc-highway',
        artist: 'AC/DC',
        title: 'Highway to Hell',
        releaseYear: 1979,
        rankings: genHistory(95, 25)
    },
    {
        id: 'linkin-end',
        artist: 'Linkin Park',
        title: 'In The End',
        releaseYear: 2001,
        rankings: genHistory(40, 15, 2001)
    },
    {
        id: 'adele-someone',
        artist: 'Adele',
        title: 'Someone Like You',
        releaseYear: 2011,
        rankings: genHistory(50, 15, 2011)
    },
    {
        id: 'eminem-lose',
        artist: 'Eminem',
        title: 'Lose Yourself',
        releaseYear: 2002,
        rankings: genHistory(60, 20, 2002)
    },
    {
        id: 'verve-bitter',
        artist: 'The Verve',
        title: 'Bitter Sweet Symphony',
        releaseYear: 1997,
        rankings: genHistory(100, 30)
    },
    {
        id: 'oasis-wonder',
        artist: 'Oasis',
        title: 'Wonderwall',
        releaseYear: 1995,
        rankings: genHistory(120, 30)
    },
    {
        id: 'robbie-angels',
        artist: 'Robbie Williams',
        title: 'Angels',
        releaseYear: 1997,
        rankings: genHistory(110, 25)
    },
    {
        id: 'coldplay-viva',
        artist: 'Coldplay',
        title: 'Viva La Vida',
        releaseYear: 2008,
        rankings: genHistory(30, 10, 2008)
    },
    {
        id: 'kensington-sorry',
        artist: 'Kensington',
        title: 'Sorry',
        releaseYear: 2016,
        rankings: genHistory(150, 40, 2016)
    },
    {
        id: 'stromae-papa',
        artist: 'Stromae',
        title: 'Papaoutai',
        releaseYear: 2013,
        rankings: genHistory(200, 50, 2013)
    },
    {
        id: 'goldband-nood',
        artist: 'Goldband',
        title: 'Noodgeval',
        releaseYear: 2021,
        rankings: genHistory(50, 10, 2021)
    },
    {
        id: 'sonneveld-dorp',
        artist: 'Wim Sonneveld',
        title: 'Het Dorp',
        releaseYear: 1974,
        rankings: genHistory(35, 10)
    },
    {
        id: 'shaffy-pastorale',
        artist: 'Ramses Shaffy',
        title: 'Pastorale',
        releaseYear: 1969,
        rankings: genHistory(55, 15)
    },
    {
        id: 'klein-muur',
        artist: 'Klein Orkest',
        title: 'Over de Muur',
        releaseYear: 1984,
        rankings: genHistory(65, 20)
    },
    {
        id: 'hazes-gelooft',
        artist: 'Andre Hazes',
        title: 'Zij Gelooft In Mij',
        releaseYear: 1981,
        rankings: genHistory(80, 25)
    },
    {
        id: 'bl-f',
        artist: 'BLØF',
        title: 'Zoutelande',
        releaseYear: 2017,
        rankings: genHistory(25, 10, 2017)
    }
];