import type { NextPage } from 'next'
import { useEffect, useState } from 'react'
import { Release } from '../lib/types';
import axios from 'axios';
import dayjs from 'dayjs';
import { ImTwitter, ImGithub } from 'react-icons/im'
import Head from 'next/head';

type ReleaseByTerm = {
    [k: string]: Release[]
}

const Index: NextPage = () => {
    const [releaseByTerm, setReleaseByTerm] = useState<ReleaseByTerm>();
    useEffect(() => {
        axios.get<{ releases: Release[] }>('/api/release/list',).then((res) => {
            const releases = res.data.releases;
            const tmpReleaseByTerm: ReleaseByTerm = {};
            releases.forEach((release) => {
                const term = dayjs(release.date).format('YYYY.MM');
                const targetTermReleases = tmpReleaseByTerm[term];
                if (targetTermReleases) {
                    targetTermReleases.push(release);
                } else {
                    tmpReleaseByTerm[term] = [release]
                }
            });
            setReleaseByTerm(tmpReleaseByTerm);
        });
    }, []);

    return (
        <div>
            <Head>
                <title>{`bandcamp-timeline`}</title>
                <meta property="og:title" content={`bandcamp-timeline`} />
                <meta property="og:image" content={`https://bandcamptimeline.unronritaro.net/ogp/top.png`} />
                <meta name="twitter:image" content={`https://bandcamptimeline.unronritaro.net/ogp/top.png`} />
                <meta name="twitter:card" content="summary_large_image" />
            </Head>
            <div className="bg-black text-white min-h-screen">
                <div className="h-full bg-cyan-900/20">
                    <header className="fixed lg:h-16 h-12 flex w-full lg:px-7 px-4">
                        <h1 className="h-auto font-bold lg:text-6xl text-3xl tracking-[-0.07em] lg:pt-3 pt-1">bandcamp-timeline</h1>
                        <div className='flex-grow' />
                        <div className='lg:text-xl text-lg flex'>
                            <ImTwitter
                                className="h-auto my-auto cursor-pointer"
                                onClick={() => {
                                    window.open('https://twitter.com/Re_venant', '_blank',);
                                }}
                            />
                            <ImGithub
                                className="h-auto my-auto ml-2 cursor-pointer"
                                onClick={() => {
                                    window.open('https://github.com/yuki-oshima-revenant/bandcamp-timeline', '_blank');
                                }}
                            />
                        </div>
                    </header>
                    <div style={{ minHeight: 'calc(100vh - 48px)' }} className="lg:pt-24 pt-12 lg:px-4 px-2">
                        {releaseByTerm && Object.entries(releaseByTerm).map(([term, releases]) => (
                            <div key={term} className="mb-2">
                                <h2 className="font-bold lg:text-3xl text-xl lg:px-4 px-2 tracking-tight">{term}</h2>
                                <div className="grid xl:grid-cols-6 md:grid-cols-4 grid-cols-2">
                                    {
                                        releases.map(({ link, coverLink, title, artist, label, date }) => (
                                            <div key={link} className="hover:bg-cyan-900/30 duration-300 lg:p-4 p-3 rounded ">
                                                <a href={link || ''} target="_blank" rel="noreferrer">
                                                    <img src={coverLink || ''} className="w-full" />
                                                    <div className="mt-2">
                                                        <div className="font-bold truncate">
                                                            {title}
                                                        </div>
                                                        <div className="text-gray-300 text-sm truncate h-5">
                                                            {artist || label}
                                                        </div>
                                                        <div className="text-gray-300 text-sm truncate h-5">
                                                            {artist ? label : ''}
                                                        </div>
                                                    </div>
                                                </a>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        ))}
                    </div>
                    <footer className='h-12 text-center py-4 text-sm'>©︎ 2022 Yuki Oshima</footer>
                </div>
            </div>
        </div>
    )
}

export default Index
