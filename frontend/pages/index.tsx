import type { NextPage } from 'next'
import { useEffect, useState } from 'react'
import { Release } from '../lib/types';
import axios from 'axios';
import dayjs from 'dayjs';
import { ImTwitter, ImGithub } from 'react-icons/im'

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
        <div className="bg-black text-white min-h-screen">
            <header className="fixed h-16 flex w-full px-6">
                <div className="h-auto my-auto font-bold text-6xl tracking-tighter">bandcamp-timeline</div>
                <div className='flex-grow' />
                <div className='text-xl flex'>
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
            <div style={{ minHeight: 'calc(100vh - 48px)' }} className="px-2 pt-20">
                {releaseByTerm && Object.entries(releaseByTerm).map(([term, releases]) => (
                    <div key={term} className="mb-2">
                        <div className="font-bold text-3xl px-4">{term}</div>
                        <div className="grid xl:grid-cols-6 md:grid-cols-4 sm:grid-cols-2 grid-cols-1 gap-2">
                            {
                                releases.map(({ link, coverLink, title, artist, label, date }) => (
                                    <div key={link} className="hover:bg-cyan-900/40 duration-300 p-4 rounded">
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
    )
}

export default Index
