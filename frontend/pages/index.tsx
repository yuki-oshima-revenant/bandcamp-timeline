import type { NextPage } from 'next'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Release, User } from '../lib/types';
import axios from 'axios';
import dayjs from 'dayjs';
import { ImTwitter, ImGithub } from 'react-icons/im';
import { VscAccount } from 'react-icons/vsc';
import { MdOutlineLogout } from 'react-icons/md';
import Head from 'next/head';
import { flushSync } from 'react-dom';

type ReleaseByTerm = {
    [k: string]: Release[]
}

const Index: NextPage = () => {
    const [releaseByTerm, setReleaseByTerm] = useState<ReleaseByTerm>();
    const [user, setUser] = useState<User>();
    const [isLogin, setIsLogin] = useState(true);
    const [password, setPassword] = useState<string>();
    const [email, setEmail] = useState<string>();
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const accountMenuRef = useRef<HTMLDivElement>(null);
    const accountButtonRef = useRef<HTMLDivElement>(null);

    const fetchData = useCallback(async () => {
        try {
            const res = await axios.get<{ releases: Release[] }>('/api/release/list',);
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
        } catch (e) {
            if (axios.isAxiosError(e)) {
                if (e.response?.status === 401) {
                    setIsLogin(false);
                    setUser(undefined);
                }
            }
        }
    }, []);

    const login = useCallback(async () => {
        try {
            const { data: { user } } = await axios.post<{ user: User }>(
                '/api/auth/login',
                { email, password },
            );
            setIsLogin(true);
            setUser(user);
            fetchData();
        } catch (e) {
            console.log(e);
            if (axios.isAxiosError(e)) {

            }
        }
    }, [email, password, fetchData]);

    const checkSession = useCallback(async () => {
        try {
            const { data: { user } } = await axios.post<{ user: User }>(
                '/api/auth/checkSession',
            );
            setUser(user);
            fetchData();
        } catch (e) {
            setIsLogin(false);
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await axios.post(
                '/api/auth/logout',
            );
            setAccountMenuOpen(false);
            setIsLogin(false);
            setUser(undefined);
        } catch (e) {
            console.log(e);
            if (axios.isAxiosError(e)) {

            }
        }
    }, [])

    useEffect(() => {
        checkSession();
    }, []);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (accountButtonRef.current) {
                const { top, bottom, right, left } = accountButtonRef.current.getBoundingClientRect();
                if (e.pageX >= left && e.pageX <= right && e.pageY >= top && e.pageY <= bottom) {
                    return;
                }
            }
            if (accountMenuRef.current) {
                const { top, bottom, right, left } = accountMenuRef.current.getBoundingClientRect();
                if (e.pageX < left || e.pageX > right || e.pageY < top || e.pageY > bottom) {
                    setAccountMenuOpen(false);
                }
            }
        };
        window.addEventListener('click', onClick);
        return () => {
            window.removeEventListener('click', onClick);
        };
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
                        <div className="flex-grow" />
                        {user && (
                            <div
                                className="lg:text-xl text-lg flex cursor-pointer "
                                onClick={() => {
                                    setAccountMenuOpen(!accountMenuOpen);
                                }}
                                ref={accountButtonRef}
                            >
                                <VscAccount className="h-auto my-auto w-6" />
                            </div>
                        )}

                        {/* <div className="lg:text-xl text-lg flex">
                            <ImTwitter
                                className="h-auto my-auto cursor-pointer"
                                onClick={() => {
                                    window.open("https://twitter.com/Re_venant", "_blank",);
                                }}
                            />
                            <ImGithub
                                className="h-auto my-auto ml-2 cursor-pointer"
                                onClick={() => {
                                    window.open('https://github.com/yuki-oshima-revenant/bandcamp-timeline', '_blank');
                                }}
                            />
                        </div> */}
                        {user && (
                            <div
                                className={`absolute bg-black top-14 right-2 lg:right-4 transition duration-200 w-64 z-50`}
                                style={{
                                    opacity: accountMenuOpen ? 1 : 0,
                                    pointerEvents: accountMenuOpen ? undefined : 'none',
                                }}
                                ref={accountMenuRef}
                            >
                                <div className='bg-cyan-900/40'>
                                    <div className="p-4">
                                        <div className="text-sm truncate">{user.email}</div>
                                    </div>
                                    <div className="border-t-[1px] p-3">
                                        <button className="text-base transition duration-300 flex w-full"
                                            onClick={() => { logout(); }}
                                        >
                                            <MdOutlineLogout className="my-auto mr-1 text-gray-400 text-lg" />
                                            Logout
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                    </header>
                    <div style={{ minHeight: 'calc(100vh - 48px)' }} className="lg:pt-24 pt-12 lg:px-4 px-2">
                        {isLogin ? (
                            <div>
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
                        ) : (
                            <div className="flex h-full">
                                <div className="m-auto mt-24 lg:mt-32 px-4 py-8 lg:p-10 lg:py-14 bg-cyan-900/20 h-auto">
                                    <div className="">
                                        <input
                                            className="h-12 text-base lg:text-lg p-3 w-80 outline-none bg-neutral-700/80 border-b-2 border-neutral-700/80 focus-within:border-cyan-700 duration-200"
                                            value={email}
                                            onChange={(e) => {
                                                setEmail(e.target.value.trim());
                                            }}
                                            type="email"
                                            placeholder="Email"
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <input
                                            className="h-12 text-base lg:text-lg p-3 w-80 outline-none bg-neutral-700/80 border-b-2 border-neutral-700/80 focus-within:border-cyan-700 duration-200"
                                            value={password}
                                            onChange={(e) => {
                                                setPassword(e.target.value.trim());
                                            }}
                                            type="password"
                                            placeholder="Password"
                                        />
                                    </div>
                                    <div className="mt-4 flex">
                                        <button
                                            className="bg-cyan-900 h-12 w-80 font-medium mx-auto hover:bg-cyan-700 duration-300"
                                            onClick={() => {
                                                login();
                                            }}
                                        >
                                            Login
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <footer className='h-12 text-center py-4 text-sm'>©︎ 2022 Yuki Oshima</footer>
                </div>
            </div>
        </div >
    )
}

export default Index
