import Header from "./components/Header";
import { cn, getLanguage } from "./utils";
import { useEffect, useState } from "react";
import { Button, Input } from "./components";
import 'react-toastify/dist/ReactToastify.css';
import PoweredBy from "./components/PoweredBy";
import { useTranslation } from "react-i18next";
import { Spinner, Tooltip } from "@radix-ui/themes";
import { ErrMessage } from "./components/ErrMessage";
import { ToastContainer, toast } from "react-toastify";
import DocumentDialog from "./components/DocumentDialog";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { LanguagePopover } from "./components/LanguagePopover";
import { selectGlobal, setGlobalState } from "./store/globalSlice";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "./components/ui/select";


const headers = { "accept": "application/json", "Content-Type": "application/json" }

type Data = {
  summary: string;
  entry_id: string;
  title: string;
  authors: string;
  updated: number;
  pdf_url: string;
  translated_title: string;
  data_cid: string;
}

const SEARCH_TYPE: {
  [key: string]: string
} = {
  "arxiv": "Arxiv",
  "google-pdf": "Google"
}

const region = import.meta.env.VITE_APP_REGION;
const apiKey = import.meta.env.VITE_APP_API_KEY;
const modelName = import.meta.env.VITE_APP_MODEL_NAME;
const showBrand = import.meta.env.VITE_APP_SHOW_BRAND === "true"


const ARXIV_SEARCH = import.meta.env.VITE_APP_ARXIV_SEARCH_URL;
const GOOGLE_SEARCH = import.meta.env.VITE_APP_GOOGLE_SEARCH_URL;
const ARXIV_SEARCH_TRANSLATE = import.meta.env.VITE_APP_ARXIV_SEARCH_TRANSLATE_URL;
const AI_TRANSLATE = import.meta.env.VITE_APP_AI_TRANSLATE_URL;


function App() {
  const dispatch = useAppDispatch()
  const { t, i18n } = useTranslation()
  const global = useAppSelector(selectGlobal)
  const [data, setData] = useState<Data[]>([])
  const SORTBY = { "relevance": t("sortby.relevance"), "-submitted_date": t("sortby.submitted_date") }

  useEffect(() => {
    const lang = getLanguage()
    i18n.changeLanguage(lang);
    dispatch(setGlobalState({ language: lang }))
  }, [])

  // 获取arxiv
  const [translateMap, setTranslateMap] = useState<{ [key: string]: string }>({})
  const [totalResults, setTotalResults] = useState<number | undefined>(undefined)
  const [nextPage, setNextPage] = useState(false)
  const [query, setQuery] = useState("")
  const [dataQuery, setDataQuery] = useState("")
  const [queryPage, setQueryPage] = useState(1)
  const [querying, setQuerying] = useState(false)
  const [sortBy, setSortBy] = useState<'relevance' | '-submitted_date'>("relevance")
  const [searchType, setSearchType] = useState<{ type: string, mode: string }>({ type: 'arxiv', mode: 'arxiv' })
  const getArxiv = async (query: string, offset: number, sort_by?: string) => {

    const searchUrl = searchType.type === "arxiv" ? ARXIV_SEARCH : GOOGLE_SEARCH;
    const searchQuery = query.trimStart().trimEnd();
    if (!query.length) {
      const dom = document.getElementById("query-input")
      if (dom) {
        dom.style.border = "1px solid #ad383c"
        setTimeout(() => {
          dom.style.border = ""
        }, 1000)
      }
      return
    }
    const language = global.language.charAt(0).toUpperCase() + global.language.slice(1)
    setQuerying(true)
    if (!/[^\w\s\d\p{P}\p{Emoji}]/gu.test(query.trimStart().trimEnd())) {
      fetch(searchUrl, {
        method: "post",
        headers,
        body: JSON.stringify({
          query: searchQuery,
          max_results: 10,
          id_list: [],
          sort_by: sort_by || sortBy,
          page: offset,
          language,
          api_key: apiKey,
          models_name: modelName,
        })
      }).then(res => res.text())
        .then(res => JSON.parse(res))
        .then(res => {
          if (res.data.error_code) {
            toast(ErrMessage(res.data.error_code, global.language, region), {
              autoClose: false,
            })
            return
          }
          setDataQuery(searchQuery)
          setQueryPage(offset)
          setNextPage(res.data.next_page)
          setTotalResults(res.data.total_results)
          setData(res.data.olist)
        }).finally(() => {
          setQuerying(false)
        })
    } else if (translateMap[searchQuery] && searchType.type === 'arxiv') {
      fetch(searchUrl, {
        method: "post",
        headers,
        body: JSON.stringify({
          query: translateMap[searchQuery],
          max_results: 10,
          id_list: [],
          sort_by: sort_by || sortBy,
          page: offset,
          language,
          api_key: apiKey,
          models_name: modelName,
        })
      }).then(res => res.text())
        .then(res => JSON.parse(res))
        .then(res => {
          if (res.data.error_code) {
            toast(ErrMessage(res.data.error_code, global.language, region), {
              autoClose: false,
            })
            return
          }
          setDataQuery(translateMap[searchQuery])
          setQueryPage(offset)
          setNextPage(res.data.next_page)
          setTotalResults(res.data.total_results)
          setData(res.data.olist)
        }).finally(() => {
          setQuerying(false)
        })
    } else {
      if (searchType.type === 'arxiv') {
        console.log(3);
        fetch(ARXIV_SEARCH_TRANSLATE, {
          method: "post",
          headers,
          body: JSON.stringify({
            original: searchQuery,
            language: "english",
            api_key: apiKey,
            models_name: modelName,
          })
        }).then(res => res.text())
          .then(res => JSON.parse(res))
          .then(res => {
            if (res.data?.msg?.err_code) {
              toast(ErrMessage(res.data?.msg?.err_code, global.language, region), {
                autoClose: false
              })
              return
            }
            return res.data.translation
          }).then((tranlation: string | undefined) => {
            if (tranlation === undefined) {
              setQuerying(false)
              return
            }
            fetch(searchUrl, {
              method: "post",
              headers,
              body: JSON.stringify({
                query: tranlation,
                max_results: 10,
                id_list: [],
                sort_by: sort_by || sortBy,
                page: offset,
                language,
                api_key: apiKey,
                models_name: modelName,
              })
            }).then(res => res.text())
              .then(res => JSON.parse(res))
              .then(res => {
                if (res.data.error_code) {
                  toast(ErrMessage(res.data.error_code, global.language, region), {
                    autoClose: false,
                  })
                  return
                }
                const translateMapTemp = translateMap
                translateMapTemp[searchQuery] = tranlation
                setTranslateMap(translateMapTemp)
                setDataQuery(tranlation)
                setQueryPage(offset)
                setNextPage(res.data.next_page)
                setTotalResults(res.data.total_results)
                setData(res.data.olist)
              }).finally(() => {
                setQuerying(false)
              })
          }).catch(() => {
            setQuerying(false)
          })
      } else {
        console.log(4);
        fetch(searchUrl, {
          method: "post",
          headers,
          body: JSON.stringify({
            query: searchQuery,
            max_results: 10,
            id_list: [],
            sort_by: sort_by || sortBy,
            page: offset,
            api_key: apiKey,
            models_name: modelName,
          })
        }).then(res => res.text())
          .then(res => JSON.parse(res))
          .then(res => {
            if (res.data.error_code) {
              toast(ErrMessage(res.data.error_code, global.language, region), {
                autoClose: false,
              })
              return
            }
            setDataQuery(searchQuery)
            setQueryPage(offset)
            setNextPage(res.data.next_page)
            setTotalResults(res.data.total_results)
            setData(res.data.olist)
          }).finally(() => {
            setQuerying(false)
          })
      }
    }
  }

  const [translateSearchTerms, setTranslateSearchTerms] = useState(false);
  // 翻译搜索词
  const onTranslateSearchTerms = () => {
    if (translateSearchTerms || !query) return;
    setTranslateSearchTerms(true)
    const myHeaders = new Headers();
    myHeaders.append("Accept", "application/json");
    myHeaders.append("Authorization", `Bearer ${apiKey}`);
    myHeaders.append("User-Agent", "Apifox/1.0.0 (https://apifox.com)");
    myHeaders.append("Content-Type", "application/json");
    const raw = JSON.stringify({
      "model": modelName,
      "message": `Translate the text into English for use as search keywords, return the result only, never explain: "${query}".`,
    });

    const requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
    };
    fetch(AI_TRANSLATE, requestOptions)
      .then(response => response.text())
      .then(res => JSON.parse(res))
      .then((result: any) => {

        if (result?.error?.err_code) {
          toast(ErrMessage(result.error.error_code, global.language, region), {
            autoClose: false,
          })
          return
        }
        if (result?.output) {
          setQuery(result.output.replace(/^['"]|['"]$/g, ''))
        }
      })
      .catch(error => {
        console.log('error', error)
      })
      .finally(() => { setTranslateSearchTerms(false) })
  }

  useEffect(() => {
    const temp = window.localStorage.getItem('searchType') || 'arxiv';
    setSearchType({ type: temp, mode: temp })
  }, [])

  useEffect(() => {
    setSearchType((v) => ({ ...v, mode: v.type }))
  }, [data])

  return <div className="fixed top-0 left-0 right-0 bottom-0 flex flex-col overflow-y-auto" style={{ backgroundColor: "#f5f5f5" }}>
    <ToastContainer />
    <Header />
    <div className="flex flex-col justify-between h-full">
      <div className={`${data?.length ? '' : 'flex-1'} relative `}>
        <div className="main-container mx-auto h-full lg:p-6 p-3 flex flex-col relative">
          <div className="flex justify-end p-2 box-border">
            <div >
              <div className='flex absolute right-2 top-2'><LanguagePopover /></div>
            </div>
          </div>
          <div>
            <div className="font-bold w-48 mb-1">{t("search.topic")}</div>
            <div className="flex items-center gap-2">
              <div className="relative w-full">
                <Input className={`w-full ${translateSearchTerms ? 'pr-20' : 'pr-12'}`} onKeyDown={(e) => {
                  const keyCode = e.key
                  const dom = window.document.getElementById("query-button")
                  if (keyCode === "Enter" && dom && !translateSearchTerms) dom.click()
                }} id="query-input" disabled={querying} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search.placeholder")} />
                {
                  searchType.type === 'google-pdf' &&
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 cursor-pointer " style={{ color: '#6b6b6b' }}>
                    {/* 翻译 */}
                    <Tooltip content={t("button.tips")}>
                      <div style={{ width: translateSearchTerms ? 71 : 50, height: '100%', padding: '5px 10px', borderTopRightRadius: 5, borderBottomRightRadius: 5 }} className="hover:bg-slate-300 flex items-center" onClick={() => { onTranslateSearchTerms() }}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
                          <path d="M152.1 236.2c-3.5-12.1-7.8-33.2-7.8-33.2h-.5s-4.3 21.1-7.8 33.2l-11.1 37.5H163zM616 96H336v320h280c13.3 0 24-10.7 24-24V120c0-13.3-10.7-24-24-24zm-24 120c0 6.6-5.4 12-12 12h-11.4c-6.9 23.6-21.7 47.4-42.7 69.9 8.4 6.4 17.1 12.5 26.1 18 5.5 3.4 7.3 10.5 4.1 16.2l-7.9 13.9c-3.4 5.9-10.9 7.8-16.7 4.3-12.6-7.8-24.5-16.1-35.4-24.9-10.9 8.7-22.7 17.1-35.4 24.9-5.8 3.5-13.3 1.6-16.7-4.3l-7.9-13.9c-3.2-5.6-1.4-12.8 4.2-16.2 9.3-5.7 18-11.7 26.1-18-7.9-8.4-14.9-17-21-25.7-4-5.7-2.2-13.6 3.7-17.1l6.5-3.9 7.3-4.3c5.4-3.2 12.4-1.7 16 3.4 5 7 10.8 14 17.4 20.9 13.5-14.2 23.8-28.9 30-43.2H412c-6.6 0-12-5.4-12-12v-16c0-6.6 5.4-12 12-12h64v-16c0-6.6 5.4-12 12-12h16c6.6 0 12 5.4 12 12v16h64c6.6 0 12 5.4 12 12zM0 120v272c0 13.3 10.7 24 24 24h280V96H24c-13.3 0-24 10.7-24 24zm58.9 216.1L116.4 167c1.7-4.9 6.2-8.1 11.4-8.1h32.5c5.1 0 9.7 3.3 11.4 8.1l57.5 169.1c2.6 7.8-3.1 15.9-11.4 15.9h-22.9a12 12 0 0 1 -11.5-8.6l-9.4-31.9h-60.2l-9.1 31.8c-1.5 5.1-6.2 8.7-11.5 8.7H70.3c-8.2 0-14-8.1-11.4-15.9z" />
                        </svg>
                        {translateSearchTerms && <Spinner className="ml-3" />}
                      </div>
                    </Tooltip>
                  </div>
                }
              </div>
              <div className="w-56">
                <Select value={searchType.type} disabled={querying} onValueChange={(value) => { setSearchType((v) => ({ ...v, type: value })); window.localStorage.setItem('searchType', value) }}>
                  <SelectTrigger>
                    {SEARCH_TYPE[searchType.type]}
                  </SelectTrigger>
                  <SelectContent style={{ maxWidth: 100 }}>
                    <SelectGroup>
                      {["arxiv", "google-pdf"].map(ele => <SelectItem key={ele} value={ele}>{SEARCH_TYPE[ele]}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className=" w-80">
                <Select value={sortBy} disabled={querying} onValueChange={(value: any) => {
                  setSortBy(value)
                }}>
                  <SelectTrigger>
                    {SORTBY[sortBy]}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {
                        ["-submitted_date", "relevance"].map((ele) => <SelectItem key={ele} value={ele}>{SORTBY[ele as "relevance" | "-submitted_date"]}</SelectItem>)
                      }
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <Button id="query-button" onClick={() => getArxiv(query, 1)} disabled={querying || !query || translateSearchTerms}>
                {querying ? <Spinner /> : <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>}
              </Button>
            </div>
          </div>
          <div className="mt-4 flex-1 flex flex-col desktop-data-list">
            <div className="font-bold w-48 mb-1">{t("search.results")} {totalResults ? "(" + totalResults + ")" : ""}</div>
            <div className={`${data?.length ? '' : 'flex-1'} flex flex-col`} style={{ border: "0.8px solid rgb(235, 238, 245)" }}>
              <div className="flex text-center font-bold" style={{ borderBottom: "0.8px solid rgb(235, 238, 245)", backgroundColor: "#f5f7fa", color: "#909399" }}>
                <div className="p-2 text-sm" style={{ flex: "3", borderRight: "0.8px solid rgb(235, 238, 245)" }}>{t("thesis_information")}</div>
                <div className="p-2 text-sm" style={{ flex: "2", borderRight: "0.8px solid rgb(235, 238, 245)" }}>{t("table:author")}</div>
                {
                  searchType.mode === 'arxiv' ? <div className="p-2 text-sm w-36" style={{ borderRight: "0.8px solid rgb(235, 238, 245)" }}>{t("update_time")}</div> : <></>
                }
                <div className="p-2 text-sm w-32">{t("table.action")}</div>
              </div>
              <div className={cn(data?.length ? "" : "flex-1 flex justify-center items-center font-bold")}>
                {data?.length ? (
                  data.map((item, index) => index < 10 && <div key={item?.entry_id || item?.data_cid} className="flex" style={{ borderBottom: "0.8px solid rgb(235, 238, 245)" }}>
                    <div className="p-3 text-xs flex flex-col gap-1" style={{ flex: "3", borderRight: "0.8px solid rgb(235, 238, 245)" }}>
                      <div>{item.title}</div>
                      {item?.translated_title ? <div className="font-bold">[ {item.translated_title} ]</div> : <></>}
                    </div>
                    <div className="p-3 text-xs flex justify-center items-center" style={{ flex: "2", borderRight: "0.8px solid rgb(235, 238, 245)" }}>{item.authors}</div>
                    {
                      searchType.mode === 'arxiv' ? <div className="p-3 text-xs flex justify-center items-center w-36" style={{ borderRight: "0.8px solid rgb(235, 238, 245)" }}>{new Date(item.updated * 1000).toLocaleString()}</div> : <></>
                    }
                    <div className="p-3 text-xs flex justify-center items-center w-32">
                      <DocumentDialog document={item} searchType={searchType.mode} />
                    </div>
                  </div>
                  )
                ) : <div style={{ color: "#909399" }}>{t("table.no_content")}</div>}
              </div>
            </div>
            {
              data?.length ? <div className="flex justify-center gap-2 mt-3">
                <div className={cn("pagenation", (queryPage === 1 || querying) ? "cursor-not-allowed" : "cursor-pointer")} style={{ backgroundColor: (queryPage === 1 || querying) ? "#f5f7fa" : "" }} onClick={() => queryPage !== 1 && !querying && getArxiv(dataQuery, queryPage - 1)}>
                  <svg width="17.5" height="17.5" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.81809 4.18179C8.99383 4.35753 8.99383 4.64245 8.81809 4.81819L6.13629 7.49999L8.81809 10.1818C8.99383 10.3575 8.99383 10.6424 8.81809 10.8182C8.64236 10.9939 8.35743 10.9939 8.1817 10.8182L5.1817 7.81819C5.09731 7.73379 5.0499 7.61933 5.0499 7.49999C5.0499 7.38064 5.09731 7.26618 5.1817 7.18179L8.1817 4.18179C8.35743 4.00605 8.64236 4.00605 8.81809 4.18179Z" fill={(queryPage === 1 || querying) ? "#a8abb2" : "currentColor"} fillRule="evenodd" clipRule="evenodd"></path></svg>
                </div>
                <div className="pagenation text-sm gap-2" style={{ width: 60 }}>
                  {querying && <Spinner />}
                  {queryPage}
                </div>
                <div className={cn("pagenation", (!nextPage || querying) ? "cursor-not-allowed" : "cursor-pointer")} onClick={() => nextPage && !querying && getArxiv(dataQuery, queryPage + 1)}>
                  <svg width="17.5" height="17.5" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.18194 4.18185C6.35767 4.00611 6.6426 4.00611 6.81833 4.18185L9.81833 7.18185C9.90272 7.26624 9.95013 7.3807 9.95013 7.50005C9.95013 7.6194 9.90272 7.73386 9.81833 7.81825L6.81833 10.8182C6.6426 10.994 6.35767 10.994 6.18194 10.8182C6.0062 10.6425 6.0062 10.3576 6.18194 10.1819L8.86374 7.50005L6.18194 4.81825C6.0062 4.64251 6.0062 4.35759 6.18194 4.18185Z" fill={(!nextPage || querying) ? "#a8abb2" : "currentColor"} fillRule="evenodd" clipRule="evenodd"></path></svg>
                </div>
              </div> : <></>
            }
          </div>
          <div className="mt-2 flex-1 flex flex-col mobile-data-list">
            <div className="font-bold w-48 mb-1">{t("search.results")} {totalResults ? "(" + totalResults + ")" : ""}</div>
            <div className="flex-1 flex flex-col" style={{ border: "0.8px solid rgb(235, 238, 245)" }}>
              <div className="flex text-center font-bold" style={{ borderBottom: "0.8px solid rgb(235, 238, 245)", backgroundColor: "#f5f7fa", color: "#909399" }}>
                <div className="p-2 text-sm" style={{ flex: "1", borderRight: "0.8px solid rgb(235, 238, 245)" }}>{t("thesis_information")}</div>
                <div className="p-2 text-sm w-16">{t("table.action")}</div>
              </div>
              <div className={cn("flex-1", data?.length ? "" : "flex justify-center items-center font-bold")}>
                {data?.length ? (
                  data.map((item, index) => index < 10 && <div key={item?.entry_id || item?.data_cid} className="flex" style={{ borderBottom: "0.8px solid rgb(235, 238, 245)" }}>
                    <div className="p-1 text-xs flex flex-col gap-1" style={{ flex: "1", borderRight: "0.8px solid rgb(235, 238, 245)" }}>
                      <div className="py-1 px-2 font-medium" style={{ backgroundColor: "#edf2fe", color: "#002bb7c5" }}>
                        <div>{t("table.title")}: {item.title}</div>
                        {item?.translated_title ? <div className="font-bold mt-1">[ {item.translated_title} ]</div> : <></>}
                      </div>
                      <div className="py-1 px-2 font-medium" style={{ backgroundColor: "#def7f9", color: "#0e7c98" }}>{t("table:author")} : {item.authors}</div>
                      {
                        searchType.mode === 'arxiv' ?
                          <div className="py-1 px-2 font-medium" style={{ backgroundColor: "#ffefd6", color: "#cc4e00" }}>{t("update_time")}: {new Date(item.updated * 1000).toLocaleString()}</div>
                          : <></>
                      }
                    </div>
                    <div className="flex justify-center items-center w-16">
                      <DocumentDialog document={item} searchType={searchType.mode} />
                    </div>
                  </div>
                  )
                ) : <div style={{ color: "#909399" }}>{t("table.no_content")}</div>}
              </div>
            </div>
            {
              data?.length ? <div className="flex justify-center gap-2 mt-3">
                <div className={cn("pagenation", (queryPage === 1 || querying) ? "cursor-not-allowed" : "cursor-pointer")} style={{ backgroundColor: (queryPage === 1 || querying) ? "#f5f7fa" : "" }} onClick={() => queryPage !== 1 && !querying && getArxiv(dataQuery, queryPage - 1)}>
                  <svg width="17.5" height="17.5" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.81809 4.18179C8.99383 4.35753 8.99383 4.64245 8.81809 4.81819L6.13629 7.49999L8.81809 10.1818C8.99383 10.3575 8.99383 10.6424 8.81809 10.8182C8.64236 10.9939 8.35743 10.9939 8.1817 10.8182L5.1817 7.81819C5.09731 7.73379 5.0499 7.61933 5.0499 7.49999C5.0499 7.38064 5.09731 7.26618 5.1817 7.18179L8.1817 4.18179C8.35743 4.00605 8.64236 4.00605 8.81809 4.18179Z" fill={(queryPage === 1 || querying) ? "#a8abb2" : "currentColor"} fillRule="evenodd" clipRule="evenodd"></path></svg>
                </div>
                <div className="pagenation text-sm gap-2" style={{ width: 60 }}>
                  {querying && <Spinner />}
                  {queryPage}
                </div>
                <div className={cn("pagenation", (!nextPage || querying) ? "cursor-not-allowed" : "cursor-pointer")} onClick={() => nextPage && !querying && getArxiv(dataQuery, queryPage + 1)}>
                  <svg width="17.5" height="17.5" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.18194 4.18185C6.35767 4.00611 6.6426 4.00611 6.81833 4.18185L9.81833 7.18185C9.90272 7.26624 9.95013 7.3807 9.95013 7.50005C9.95013 7.6194 9.90272 7.73386 9.81833 7.81825L6.81833 10.8182C6.6426 10.994 6.35767 10.994 6.18194 10.8182C6.0062 10.6425 6.0062 10.3576 6.18194 10.1819L8.86374 7.50005L6.18194 4.81825C6.0062 4.64251 6.0062 4.35759 6.18194 4.18185Z" fill={(!nextPage || querying) ? "#a8abb2" : "currentColor"} fillRule="evenodd" clipRule="evenodd"></path></svg>
                </div>
              </div> : <></>
            }
          </div>
        </div>
      </div>
      {showBrand && <PoweredBy />}
    </div>
  </div>
}

export default App
