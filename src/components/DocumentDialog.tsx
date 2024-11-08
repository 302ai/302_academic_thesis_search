import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from ".";
import { useEffect, useState } from "react";
import { Spinner } from "@radix-ui/themes";
import '@radix-ui/themes/styles.css';
import { Theme } from '@radix-ui/themes';
import { toast } from "react-toastify";
import { ErrMessage } from "./ErrMessage";
import { cn, isValidJSONObject } from "../utils";
import { selectGlobal } from "../store/globalSlice";
import { useAppSelector } from "../store/hooks";
import { marked } from "marked"
import Loading from "./ui/loading";
import { useTranslation } from "react-i18next";

const headers = {
  "accept": "application/json",
  "Content-Type": "application/json"
}

type Data = {
  entry_id: string;
  title: string;
  summary: string;
  authors: string;
  updated: number;
  pdf_url: string;
  translated_title: string;
}

const region = import.meta.env.VITE_APP_REGION;
const apiKey = import.meta.env.VITE_APP_API_KEY;
const modelName = import.meta.env.VITE_APP_MODEL_NAME;
const SSE_CHAT_URL = import.meta.env.VITE_APP_SSE_CHAT_URL;
const INTERPRET_URL = import.meta.env.VITE_APP_INTERPRET_URL;
const ABSTRACT_URL = import.meta.env.VITE_APP_ABSTRACT_URL;
const LATEX_TRANSLATE_URL = import.meta.env.VITE_APP_LATEX_TRANSLATE_URL;
const TASKS_URL = import.meta.env.VITE_APP_TASKS_URL;
const DOMAIN_NAME_URL = import.meta.env.VITE_APP_DOMAIN_NAME_URL;



export default function DocumentDialog({ document, searchType }: { document: Data, searchType?: string }) {
  const { t } = useTranslation()
  const [userAgent, setUserAgent] = useState("")
  useEffect(() => {
    setUserAgent(navigator.userAgent.toLocaleLowerCase())
    window.onresize = () => {
      const dom = window.document.getElementById("tab-content")
      if (dom) {
        const domWidth = dom.offsetWidth
        setQueryWidth((domWidth - 80) + "px")
      }
      const dom1 = window.document.getElementById("tab-content")
      if (dom1) {
        const domWidth = dom1.offsetWidth
        setTranslateWidth((domWidth - 40) + "px")
      }
    }
  }, [])

  const [desktopActiveTab, setDesktopActiveTab] = useState("summary")
  const [mobileActiveTab, setMobileActiveTab] = useState("paper")
  const global = useAppSelector(selectGlobal)

  // 提问
  const [queryWidth, setQueryWidth] = useState<string | undefined>(undefined)
  const [parseTaskId, setParseTaskId] = useState("")
  const [query, setQuery] = useState("")
  const [querying, setQuerying] = useState(false)
  const [queryInfo, setQueryInfo] = useState<{
    history: string[],
    progress: number
  } | undefined>(undefined)
  async function queryPaper() {
    const historyTemp = queryInfo?.history || []
    setQueryInfo({
      history: [...historyTemp, "query-user_say-" + query],
      progress: 100
    })
    toScrollBottom("answer")
    setQuery("")
    setQuerying(true)
    fetch(SSE_CHAT_URL, {
      method: "post",
      headers,
      body: JSON.stringify({
        task_id: parseTaskId,
        query,
        language: global.language,
        api_key: apiKey,
        models_name: modelName,
      })
    }).then((response) => {
      if (response.ok && response.body) {
        const reader = response.body.getReader();
        readStream(reader, "")
      }
      function readStream(reader: ReadableStreamDefaultReader<Uint8Array>, answer: string): Promise<ReadableStreamDefaultReader<Uint8Array> | undefined> {
        if (answer) setQuerying(false)
        return reader.read().then(({ value }) => {
          const chunk = new TextDecoder('utf-8').decode(value);
          if (chunk.indexOf("Error") > -1) {
            const chunkArr = chunk.replace("Error:", "").replace("data:", "").replace("{", "").replace("}", "").trimStart().trimEnd().split(",")
            chunkArr.forEach(chunk => {
              if (chunk.indexOf("err_code") > -1) {
                setParseErr(ErrMessage(+chunk.split(":")[1], global.language, region))
                toScrollBottom("answer")
              }
            })
            setQuerying(false)
            return
          }
          if (chunk.indexOf("[DONE]") > -1) {
            const splitAnswer = answer.split("\\n")
            const splitAnswerMarked = splitAnswer.map(str => {
              if (str) return marked.parse(str)
              else return ""
            })
            setQueryInfo({
              history: [...historyTemp, "query-user_say-" + query, "query-gpt_say-" + splitAnswerMarked.join("")],
              progress: 100
            })
            setQuerying(false)
            return
          }
          const chunkList = chunk.split("\n").filter(chunk => chunk).map(chunk => chunk.replace("data:", "").trimStart().trimEnd().replace(/'/g, '"'))
          chunkList.forEach(chunk => {
            if (!chunk || !isValidJSONObject(chunk)) return;
            const chunkJSON = JSON.parse(chunk)
            chunkJSON?.choices.forEach((choice: {
              delta: {
                content: string
              }
            }) => {
              const content = choice?.delta?.content
              if (content) {
                answer += content
                const splitAnswer = answer.split("\\n")
                const splitAnswerMarked = splitAnswer.map(str => {
                  if (str) return marked.parse(str)
                  else return ""
                })
                setQueryInfo({
                  history: [...historyTemp, "query-user_say-" + query, "query-gpt_say-" + splitAnswerMarked.join("")],
                  progress: 100
                })
                toScrollBottom("answer")
              }
            })
          })
          return readStream(reader, answer);
        });
      }
    })
  }
  // 解析论文
  const [parsedPaper, setParsedPaper] = useState(false)
  const [parsingPaper, setParsingPaper] = useState(false)
  async function parsePaper() {
    setParsingPaper(true)
    fetch(INTERPRET_URL, {
      method: "post",
      headers,
      body: JSON.stringify({
        // arxiv_id: document.entry_id.split("/abs/")[1],
        arxiv_id: searchType === 'arxiv' ? document.entry_id.split("/abs/")[1] : '',
        pdf_url: searchType === 'arxiv' ? '' : document.pdf_url,
        language: global.language,
        api_key: apiKey,
        models_name: modelName,
        use_cache: true
      })
    }).then(res => res.text())
      .then(res => JSON.parse(res))
      .then(res => {
        if (res.data.err_code) {
          toast.error(res.data.err_code)
          setParsingPaper(false)
          return
        }
        const dom = window.document.getElementById("tab-content")
        if (dom) {
          const domWidth = dom.offsetWidth
          setQueryWidth((domWidth - 80) + "px")
        }
        if (res.data?.cache_data?.history?.length) {
          setQueryInfo({
            history: res.data.cache_data.history.filter((history: string) => history.indexOf("user_say") === -1),
            progress: res.data.cache_data.progress
          })
          setParseTaskId(res.data.task_id)
          setParsingPaper(false)
          setParsedPaper(true)
          toScrollBottom("answer")
        }
        else getTaskInfo(res.data.task_id, "parse")
      })
  }
  // 生成摘要
  const [summarying, setSummarying] = useState(false)
  const [summary, setSummary] = useState<{
    history: string[],
    progress: number
  } | undefined>(undefined)
  async function generateSummary() {
    setSummarying(true)
    fetch(ABSTRACT_URL, {
      method: "post",
      headers,
      body: JSON.stringify({
        arxiv_id: searchType === 'arxiv' ? document.entry_id.split("/abs/")[1] : '',
        pdf_url: searchType === 'arxiv' ? '' : document.pdf_url,
        language: global.language,
        api_key: apiKey,
        models_name: modelName,
        use_cache: true
      })
    }).then(res => res.text())
      .then(res => JSON.parse(res))
      .then(res => {
        if (res.data.err_code) {
          setSummarying(false)
          toast.error(res.data.err_code)
          return
        }
        if (!res.data.task_id) {
          setSummary({
            history: res.data.cache_data.history,
            progress: res.data.cache_data.progress || 0
          })
          setSummarying(false)
          toScrollBottom("summary")
        }
        else getTaskInfo(res.data.task_id, "summary")
      })
  }

  // 全文翻译
  const [translatePdfUrl, setTranslatePdfUrl] = useState("")
  const [fullTextTranslation, setFullTextTranslation] = useState<{
    history: string[],
    progress: number
  } | undefined>(undefined)
  const [translateErr, setTranslateErr] = useState<React.ReactNode | undefined>(undefined)
  const [translating, setTranslating] = useState(false)
  const [translateWidth, setTranslateWidth] = useState<string | undefined>(undefined)
  async function getTranslate() {
    setTranslating(true)
    fetch(LATEX_TRANSLATE_URL, {
      method: "post",
      headers,
      body: JSON.stringify({
        arxiv_id: searchType === 'arxiv' ? document.entry_id.split("/abs/")[1] : '',
        pdf_url: searchType === 'arxiv' ? '' : document.pdf_url,
        language: global.language,
        api_key: apiKey,
        models_name: modelName,
        use_cache: true,
        ori_title: document.title,
        translated_title: document.translated_title
      })
    }).then(res => res.text())
      .then(res => JSON.parse(res))
      .then(res => {
        if (res.data.err_code) {
          setTranslating(false)
          toast.error(res.data.err_code)
          return
        }
        const dom = window.document.getElementById("tab-content")
        if (dom) {
          const domWidth = dom.offsetWidth
          setTranslateWidth((domWidth - 40) + "px")
        }
        getTaskInfo(res.data.task_id, "translate")
      })
  }

  // 查询任务
  const [taskIntervalId, setTaskInterval] = useState({
    summary: 0,
    translate: 0,
    query: 0,
    parse: 0
  })
  const [summaryErr, setSummaryErr] = useState<React.ReactNode | undefined>(undefined)
  const [parseErr, setParseErr] = useState<React.ReactNode | undefined>(undefined)
  async function getTaskInfo(taskId: string, type: "summary" | "translate" | "query" | "parse") {
    if (taskIntervalId[type]) clearInterval(taskIntervalId[type])
    const taskIntervalIdTemp = taskIntervalId
    let intervalTime = 2000
    if (type === "parse" || type === "translate") intervalTime = 6000
    else if (type === "summary") intervalTime = 4000
    const intervalId = setInterval(() => {
      setTaskInterval({
        ...taskIntervalIdTemp,
        [type]: intervalId
      })
      fetch(TASKS_URL + taskId, {
        method: "get",
        headers
      }).then(res => res.text())
        .then(res => JSON.parse(res))
        .then(res => {
          if (res.data.progress === -1) {
            if (type === "summary") setSummarying(false)
            else if (type === "translate") setTranslating(false)
            else if (type === "parse") setParsingPaper(false)
            if (res.data.msg?.err_code) {
              if (type === "summary") setSummaryErr(ErrMessage(res.data.msg.err_code, global.language, region))
              else if (type === "parse") setParseErr(ErrMessage(res.data.msg.err_code, global.language, region))
              else if (type === "translate") setTranslateErr(ErrMessage(res.data.msg.err_code, global.language, region))
            }
            if (type === "translate") {
              if (res.data.msg?.err_code) setTranslateErr(ErrMessage(res.data.msg.err_code, global.language, region))
              else setFullTextTranslation({
                history: res.data.history,
                progress: res.data.progress || 0
              })
            }
            clearInterval(intervalId)
            return
          }
          const data = {
            history: res.data.history,
            progress: res.data.progress || 0
          }
          if (type === "summary") setSummary(data)
          else if (type === "translate") {
            setFullTextTranslation(data)
            for (let i = res.data.history.length - 1; i >= 0; i--) {
              if (res.data.history[i].indexOf("merge_translate_zh_pdf_url-") > -1) {
                const pdfUrl = res.data.history[i].split("merge_translate_zh_pdf_url-")[1]
                setTranslatePdfUrl(pdfUrl)
                break
              }
            }
          }
          else if (type === "parse") {
            setQueryInfo({
              ...data,
              history: res.data.history.filter((history: string) => history.indexOf("user_say") === -1)
            })
          }
          if (res.data.progress === 100) {
            if (type === "summary") setSummarying(false)
            else if (type === "translate") setTranslating(false)
            else if (type === "parse") {
              setParseTaskId(taskId)
              setParsedPaper(true)
              setParsingPaper(false)
            }
            clearInterval(intervalId)
          }
          toScrollBottom(type)
        })
    }, intervalTime)
  }

  useEffect(() => {
    setHeight()
  }, [summary, fullTextTranslation])

  useEffect(() => {
    toScrollBottom("answer", "instant")
    toScrollBottom("summary", "instant")
    toScrollBottom("translate", "instant")
  }, [desktopActiveTab, mobileActiveTab])

  function setHeight() {
    const contentHiehgt = window.innerHeight * 0.9 - 48.5
    const summaryDom = window.document.getElementById("summary")
    const translateDom = window.document.getElementById("translate")
    const answerDom = window.document.getElementById("answer")
    if (summaryDom) summaryDom.style.height = (contentHiehgt - 8 - 48) + "px"
    if (translateDom) translateDom.style.height = (contentHiehgt - 8 - 48) + "px"
    if (answerDom) answerDom.style.height = (contentHiehgt - 60 - 48) + "px"
  }

  function toScrollBottom(id: string, behavior: "smooth" | "instant" = "smooth") {
    setTimeout(() => {
      const domId = (id === "parse" ? "answer" : id)
      const desktopDom = window.document.getElementById(domId)
      let mobileDom = window.document.getElementById(domId + "-mobile")
      if (domId !== "answer") mobileDom = mobileDom?.parentElement || null
      desktopDom?.scrollBy({
        top: 99999,
        behavior
      })
      mobileDom?.scrollBy({
        top: 99999,
        behavior
      })
    })
  }
  const [loading, setLoading] = useState(true);
  const handleLoad = () => {
    setLoading(false)
  }

  const onRendering = () => {
    if (userAgent.indexOf("iphone") === -1) {
      const src = searchType === 'google-pdf' ? `${DOMAIN_NAME_URL}/api/v1/pdf?url=${document.pdf_url}` : `${document.pdf_url.replace("http://", "https://")}#navpanes=0&toolbar=1`
      // 电脑端
      return (
        <div className="flex-1 relative h-full w-full">
          {loading && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 999,
              fontSize: '20px',
              color: '#555'
            }}>
              <Loading />
            </div>
          )}
          <iframe src={src} className="w-full h-full" onLoad={handleLoad} />
        </div>
      )
    } else {
      // 手机端
      return (
        <a
          target="_blank"
          style={{ backgroundColor: "#eff3f2", color: "#0070f0" }}
          href={document.pdf_url.replace("http://", "https://") + "#navpanes=0&toolbar=0"}
          className="absolute top-0 left-0 right-0 bottom-0 flex justify-center items-center font-bold">{t("open_pdf")}
        </a>
      )
    }
  }

  return <Dialog onOpenChange={(value) => {
    if (!value) {
      if (taskIntervalId.parse) {
        clearInterval(taskIntervalId.parse)
        if (queryInfo?.progress !== 100) {
          setQueryInfo(undefined)
          setParsingPaper(false)
        }
      }
      if (taskIntervalId.summary) {
        clearInterval(taskIntervalId.summary)
        if (summary?.progress !== 100) {
          setSummary(undefined)
          setSummarying(false)
          setSummaryErr(undefined)
        }
      }
      if (taskIntervalId.translate) {
        clearInterval(taskIntervalId.translate)
        if (fullTextTranslation?.progress !== 100) {
          setFullTextTranslation(undefined)
          setTranslating(false)
        }
      }
    } else {
      toScrollBottom("answer", "instant")
      toScrollBottom("summary", "instant")
      toScrollBottom("translate", "instant")
    }
  }}>
    <DialogTrigger>
      <Button variant="secondary" size="sm" onClick={() => {
        setTimeout(() => {
          setHeight()
          setLoading(true)
        })
      }}>{t("open")}</Button>
    </DialogTrigger>
    <DialogContent hidden={true} className="p-0 flex flex-col" style={{ maxWidth: 2560, margin: '0 auto' }}>
      <div className="flex justify-center text-lg font-bold text-center py-1 desktop-data-list" style={{ backgroundColor: "#f7f9f8", borderBottom: "1px solid rgb(240, 240, 243)" }}>
        [ {document?.translated_title || document?.title} ]
      </div>
      <div className="flex-1 relative">
        <div className="flex-1 flex desktop-data-list absolute left-0 right-0 top-0 bottom-0">
          {onRendering()}
          <div className="flex-1 flex flex-col" style={{ backgroundColor: "#f7f9f8" }}>
            <div className="flex p-2 pt-1 px-5 font-bold" >
              <div onClick={() => setDesktopActiveTab("summary")} className="w-28 text-center cursor-pointer" style={{ padding: "2.5px", borderBottom: desktopActiveTab === "summary" ? "2px solid #296d4d" : "1px solid #f0f0f3", color: desktopActiveTab === "summary" ? "#296d4d" : "#8c8f95" }}>{t("full_text_summary")}</div>
              <div onClick={() => setDesktopActiveTab("translate")} className="w-28 text-center cursor-pointer" style={{ padding: "2.5px", borderBottom: desktopActiveTab === "translate" ? "2px solid #296d4d" : "1px solid #f0f0f3", color: desktopActiveTab === "translate" ? "#296d4d" : "#8c8f95" }}>{t("full_text_translation")}</div>
              <div onClick={() => setDesktopActiveTab("query")} className="w-28 text-center cursor-pointer" style={{ padding: "2.5px", borderBottom: desktopActiveTab === "query" ? "2px solid #296d4d" : "1px solid #f0f0f3", color: desktopActiveTab === "query" ? "#296d4d" : "#8c8f95" }}>{t("ai_qa")}</div>
            </div>
            <div id="tab-content" className="flex-1 flex flex-col">
              <div className="flex-1 flex-col" style={{ display: desktopActiveTab === "summary" ? "flex" : "none" }}>
                <div className="flex-1 mx-5 text-sm mb-2 relative overflow-y-auto" style={{ backgroundColor: "#eff3f2", color: "#282c2b" }}>
                  {(summary || summarying || summaryErr) ? <div id="summary" className="text-base p-2 pt-1 overflow-y-auto">
                    {summary?.history.map(history => <div key={history} className="my-1 p-2" style={{ backgroundColor: "#e2f4e8", border: "0.8px solid #e2f4e8" }}>{history.replace("user_say-", "").replace("gpt_say-", "")}</div>)}
                    {summarying && <Theme className="my-1 p-2 flex gap-2 items-center" style={{ backgroundColor: "#e2f4e8", border: "0.8px solid #e2f4e8" }}>
                      <div style={{ color: "rgb(41, 109, 77)" }}>{t("summary_progress")} {summary?.progress || 0} %</div>
                      <Spinner />
                    </Theme>}
                    {
                      summaryErr && <div className="my-1 p-2 flex gap-2" style={{ backgroundColor: "#ffe9f0", border: "0.8px solid #ffe9f0", color: "#d13372" }}>
                        {summaryErr}
                        <div> {t("or")} <span className="underline cursor-pointer" onClick={() => {
                          setSummary(undefined)
                          setSummaryErr(undefined)
                          generateSummary()
                        }} style={{ color: "rgb(0, 112, 240)" }}>{t("translation_summary_retry ")}</span></div>
                      </div>
                    }
                  </div> : <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col justify-center items-center cursor-pointer px-14 py-10 rounded-2xl" style={{ backgroundColor: "rgb(208 208 208 / 30%)" }} onClick={generateSummary}>
                    <svg width="55" height="55" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 2.5C3 2.22386 3.22386 2 3.5 2H9.08579C9.21839 2 9.34557 2.05268 9.43934 2.14645L11.8536 4.56066C11.9473 4.65443 12 4.78161 12 4.91421V12.5C12 12.7761 11.7761 13 11.5 13H3.5C3.22386 13 3 12.7761 3 12.5V2.5ZM3.5 1C2.67157 1 2 1.67157 2 2.5V12.5C2 13.3284 2.67157 14 3.5 14H11.5C12.3284 14 13 13.3284 13 12.5V4.91421C13 4.51639 12.842 4.13486 12.5607 3.85355L10.1464 1.43934C9.86514 1.15804 9.48361 1 9.08579 1H3.5ZM4.5 4C4.22386 4 4 4.22386 4 4.5C4 4.77614 4.22386 5 4.5 5H7.5C7.77614 5 8 4.77614 8 4.5C8 4.22386 7.77614 4 7.5 4H4.5ZM4.5 7C4.22386 7 4 7.22386 4 7.5C4 7.77614 4.22386 8 4.5 8H10.5C10.7761 8 11 7.77614 11 7.5C11 7.22386 10.7761 7 10.5 7H4.5ZM4.5 10C4.22386 10 4 10.2239 4 10.5C4 10.7761 4.22386 11 4.5 11H10.5C10.7761 11 11 10.7761 11 10.5C11 10.2239 10.7761 10 10.5 10H4.5Z" fill="#8c8f95" fillRule="evenodd" clipRule="evenodd"></path></svg>
                    <div className="text-lg font-bold text-center" style={{ color: "#8c8f95" }}>{t("translation_summary")}</div>
                  </div>}
                </div>
              </div>
              <div className="flex-1 flex-col" style={{ display: desktopActiveTab === "translate" ? "flex" : "none" }}>
                {!translatePdfUrl && <div className="flex-1 mx-5 text-sm mb-2 relative overflow-y-auto" style={{ backgroundColor: "#eff3f2", color: "#282c2b" }}>
                  {(fullTextTranslation || translating || translateErr) ? <div id="translate" className="text-base p-2 pt-1 overflow-y-auto">
                    {fullTextTranslation?.history.map(history => <div key={history} className="my-1 p-2" style={{ backgroundColor: "#e2f4e8", border: "0.8px solid #e2f4e8", width: translateWidth ? translateWidth : undefined }}>
                      {history.indexOf("translate_html-") > -1 && (
                        history.replace("translate_html-", "") ?
                          <a href={DOMAIN_NAME_URL + history.replace("translate_html-", "")} target="_blank" className="underline" style={{ color: "rgb(0, 112, 240)" }}>{t("full_text_translation_html_success")}</a> :
                          (t("full_text_translation_html_error"))
                      )}
                      {history.indexOf("merge_translate_zh_pdf_url-") > -1 && <></>}
                      {history.indexOf("merge_translate_zh_pdf_url-") > -1 && (
                        history.replace("merge_translate_zh_pdf_url-", "") ?
                          <a href={history.replace("merge_translate_zh_pdf_url-", "")} target="_blank" className="underline" style={{ color: "rgb(0, 112, 240)" }}>{t("full_text_translation_pdf_success")}</a> :
                          (t("full_text_translation_pdf_error"))
                      )}
                      {history.indexOf("zip_302_url-") > -1 && (
                        history.replace("zip_302_url-", "") ?
                          <a href={history.replace("zip_302_url-", "")} target="_blank" className="underline" style={{ color: "rgb(0, 112, 240)" }}>{t("full_text_translation_generation")}</a> :
                          (t("full_text_translation_error"))
                      )}
                      {history.indexOf("merge_translate_zh_pdf_url-") === -1 && history.indexOf("translate_html-") === -1 && history.indexOf("zip_302_url-") === -1 && history.replace("user_say-", "").replace("gpt_say-", "")}
                    </div>)}
                    {translating && <Theme className="my-1 p-2 flex gap-2 items-center" style={{ backgroundColor: "#e2f4e8", border: "0.8px solid #e2f4e8" }}>
                      <div style={{ color: "rgb(41, 109, 77)" }}>{t("translation_progress")} {fullTextTranslation?.progress || 0} %</div>
                      <Spinner />
                    </Theme>}
                    {
                      translateErr && <div className="my-1 p-2 flex gap-2" style={{ backgroundColor: "#ffe9f0", border: "0.8px solid #ffe9f0", color: "#d13372" }}>
                        {translateErr}
                        <div> {t("or")} <span className="underline cursor-pointer" onClick={() => {
                          setFullTextTranslation(undefined)
                          setTranslateErr(undefined)
                          getTranslate()
                        }} style={{ color: "rgb(0, 112, 240)" }}>{t("retry_to_generate")}</span></div>
                      </div>
                    }
                  </div> : <div onClick={() => getTranslate()} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col justify-center items-center cursor-pointer px-14 py-10 rounded-2xl" style={{ backgroundColor: "rgb(208 208 208 / 30%)" }}>
                    <svg width="55" height="55" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.49996 1.80002C4.35194 1.80002 1.79996 4.352 1.79996 7.50002C1.79996 10.648 4.35194 13.2 7.49996 13.2C10.648 13.2 13.2 10.648 13.2 7.50002C13.2 4.352 10.648 1.80002 7.49996 1.80002ZM0.899963 7.50002C0.899963 3.85494 3.85488 0.900024 7.49996 0.900024C11.145 0.900024 14.1 3.85494 14.1 7.50002C14.1 11.1451 11.145 14.1 7.49996 14.1C3.85488 14.1 0.899963 11.1451 0.899963 7.50002Z" fill="#8c8f95" fillRule="evenodd" clipRule="evenodd"></path><path d="M13.4999 7.89998H1.49994V7.09998H13.4999V7.89998Z" fill="#8c8f95" fillRule="evenodd" clipRule="evenodd"></path><path d="M7.09991 13.5V1.5H7.89991V13.5H7.09991zM10.375 7.49998C10.375 5.32724 9.59364 3.17778 8.06183 1.75656L8.53793 1.24341C10.2396 2.82218 11.075 5.17273 11.075 7.49998 11.075 9.82724 10.2396 12.1778 8.53793 13.7566L8.06183 13.2434C9.59364 11.8222 10.375 9.67273 10.375 7.49998zM3.99969 7.5C3.99969 5.17611 4.80786 2.82678 6.45768 1.24719L6.94177 1.75281C5.4582 3.17323 4.69969 5.32389 4.69969 7.5 4.6997 9.67611 5.45822 11.8268 6.94179 13.2472L6.45769 13.7528C4.80788 12.1732 3.9997 9.8239 3.99969 7.5z" fill="#8c8f95" fillRule="evenodd" clipRule="evenodd"></path><path d="M7.49996 3.95801C9.66928 3.95801 11.8753 4.35915 13.3706 5.19448 13.5394 5.28875 13.5998 5.50197 13.5055 5.67073 13.4113 5.83948 13.198 5.89987 13.0293 5.8056 11.6794 5.05155 9.60799 4.65801 7.49996 4.65801 5.39192 4.65801 3.32052 5.05155 1.97064 5.8056 1.80188 5.89987 1.58866 5.83948 1.49439 5.67073 1.40013 5.50197 1.46051 5.28875 1.62927 5.19448 3.12466 4.35915 5.33063 3.95801 7.49996 3.95801zM7.49996 10.85C9.66928 10.85 11.8753 10.4488 13.3706 9.6135 13.5394 9.51924 13.5998 9.30601 13.5055 9.13726 13.4113 8.9685 13.198 8.90812 13.0293 9.00238 11.6794 9.75643 9.60799 10.15 7.49996 10.15 5.39192 10.15 3.32052 9.75643 1.97064 9.00239 1.80188 8.90812 1.58866 8.9685 1.49439 9.13726 1.40013 9.30601 1.46051 9.51924 1.62927 9.6135 3.12466 10.4488 5.33063 10.85 7.49996 10.85z" fill="#8c8f95" fillRule="evenodd" clipRule="evenodd"></path></svg>
                    <div className=" text-lg font-bold text-center" style={{ color: "#8c8f95" }}>{t("click_to_generate_a_full")}</div>
                  </div>}
                </div>}
                {translatePdfUrl && <iframe className="mx-5" src={translatePdfUrl + "#navpanes=0&toolbar=1"} height="100%" />}
              </div>
              <div className="flex-1 flex-col" style={{ display: desktopActiveTab === "query" ? "flex" : "none" }}>
                <div className="flex-1 mx-5 text-sm" style={{ backgroundColor: "#eff3f2", color: "#282c2b" }}>
                  <div id="answer" className="text-base overflow-y-auto p-2 pt-1 relative">
                    {(!parsedPaper && !parsingPaper && parseErr === undefined) && <div onClick={parsePaper} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col justify-center items-center cursor-pointer px-14 py-10 rounded-2xl" style={{ backgroundColor: "rgb(208 208 208 / 30%)" }}>
                      <svg width="55" height="55" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.900024 7.50002C0.900024 3.85495 3.85495 0.900024 7.50002 0.900024C11.1451 0.900024 14.1 3.85495 14.1 7.50002C14.1 11.1451 11.1451 14.1 7.50002 14.1C3.85495 14.1 0.900024 11.1451 0.900024 7.50002ZM7.50002 1.80002C4.35201 1.80002 1.80002 4.35201 1.80002 7.50002C1.80002 10.648 4.35201 13.2 7.50002 13.2C10.648 13.2 13.2 10.648 13.2 7.50002C13.2 4.35201 10.648 1.80002 7.50002 1.80002ZM3.07504 7.50002C3.07504 5.05617 5.05618 3.07502 7.50004 3.07502C9.94388 3.07502 11.925 5.05617 11.925 7.50002C11.925 9.94386 9.94388 11.925 7.50004 11.925C5.05618 11.925 3.07504 9.94386 3.07504 7.50002ZM7.50004 3.92502C5.52562 3.92502 3.92504 5.52561 3.92504 7.50002C3.92504 9.47442 5.52563 11.075 7.50004 11.075C9.47444 11.075 11.075 9.47442 11.075 7.50002C11.075 5.52561 9.47444 3.92502 7.50004 3.92502ZM7.50004 5.25002C6.2574 5.25002 5.25004 6.25739 5.25004 7.50002C5.25004 8.74266 6.2574 9.75002 7.50004 9.75002C8.74267 9.75002 9.75004 8.74266 9.75004 7.50002C9.75004 6.25738 8.74267 5.25002 7.50004 5.25002ZM6.05004 7.50002C6.05004 6.69921 6.69923 6.05002 7.50004 6.05002C8.30084 6.05002 8.95004 6.69921 8.95004 7.50002C8.95004 8.30083 8.30084 8.95002 7.50004 8.95002C6.69923 8.95002 6.05004 8.30083 6.05004 7.50002Z" fill="#8c8f95" fillRule="evenodd" clipRule="evenodd"></path></svg>
                      <div className=" text-lg font-bold text-center" style={{ color: "#8c8f95" }}>{t("ai_analysis")}</div>
                    </div>}
                    {queryInfo?.history.map((history, index) => <>
                      {
                        history.indexOf("query-user_say-") === -1 && <>
                          {
                            history.indexOf("err_code-") === -1 && <div key={index} className="flex items-start gap-2" style={{ width: queryWidth ? queryWidth : undefined }}>
                              <img src="https://file.302.ai/gpt/imgs/5b36b96aaa052387fb3ccec2a063fe1e.png" width={30} height={30} className="object-contain mt-2" />
                              <div key={index} className="my-1 p-2" style={{ backgroundColor: "#e2f4e8", border: "0.8px solid #e2f4e8", wordWrap: 'break-word' }} dangerouslySetInnerHTML={{ __html: history.replace("query-", "").replace("gpt_say-", "").replace("user_say-", "") }}></div>
                            </div>
                          }
                          {
                            history.indexOf("err_code-") > -1 && <>
                              <div key={index} className="flex items-start gap-2">
                                <img src="https://file.302.ai/gpt/imgs/5b36b96aaa052387fb3ccec2a063fe1e.png" width={30} height={30} className="object-contain mt-2" />
                                <div key={index} className="my-1 p-2" style={{ backgroundColor: "#ffe9f0", border: "0.8px solid #ffe9f0", color: "#d13372" }}>
                                  {history.indexOf("-10001") > -1 && ErrMessage(-10001, global.language, region)}
                                  {history.indexOf("-10002") > -1 && ErrMessage(-10002, global.language, region)}
                                  {history.indexOf("-10003") > -1 && ErrMessage(-10003, global.language, region)}
                                  {history.indexOf("-10004") > -1 && ErrMessage(-10004, global.language, region)}
                                  {history.indexOf("-10005") > -1 && ErrMessage(-10005, global.language, region)}
                                  {history.indexOf("-10006") > -1 && ErrMessage(-10006, global.language, region)}
                                  {history.indexOf("-10007") > -1 && ErrMessage(-10007, global.language, region)}
                                  {history.indexOf("-10008") > -1 && ErrMessage(-10008, global.language, region)}
                                  {history.indexOf("-10009") > -1 && ErrMessage(-10009, global.language, region)}
                                  {history.indexOf("-10012") > -1 && ErrMessage(-10012, global.language, region)}
                                  {history.indexOf("-1024") > -1 && ErrMessage(-1024, global.language, region)}
                                </div>
                              </div>
                            </>
                          }
                        </>
                      }
                      {
                        history.indexOf("query-user_say-") > -1 && <div className="flex justify-end">
                          <div key={index} className="my-1 p-2 inline-block" style={{ backgroundColor: "#e6f4fe", border: "0.8px solid #e6f4fe", color: "#006dcbf2" }}>{history.replace("query-user_say-", "")}</div>
                        </div>
                      }
                    </>)}
                    {parsingPaper && <div className="flex items-start gap-2">
                      <img src="https://file.302.ai/gpt/imgs/5b36b96aaa052387fb3ccec2a063fe1e.png" width={30} height={30} className="object-contain mt-2" />
                      <Theme className="my-1 p-2 flex gap-2 items-center" style={{ backgroundColor: "#e2f4e8", border: "0.8px solid #e2f4e8" }}>
                        <div style={{ color: "rgb(41, 109, 77)" }}>{t("analyze_progress")} {queryInfo?.progress || 0} %</div>
                        <Spinner />
                      </Theme>
                    </div>}
                    {
                      parseErr && <div className="flex items-start gap-2">
                        <img src="https://file.302.ai/gpt/imgs/5b36b96aaa052387fb3ccec2a063fe1e.png" width={30} height={30} className="object-contain mt-2" />
                        <div className="my-1 p-2 flex gap-2 items-center cursor-pointer" style={{ backgroundColor: "#ffe9f0", border: "0.8px solid #ffe9f0", color: "#d13372" }}>
                          {parseErr}
                          <div> {t("or")} <span onClick={() => {
                            setParseErr(undefined)
                            setQueryInfo(undefined)
                            parsePaper()
                          }} className="underline font-bold" style={{ color: "rgb(0, 112, 240)" }}>{t("reanalyze_ai")}</span></div>
                        </div>
                      </div>
                    }
                    {
                      querying && <div className="flex items-start gap-2">
                        <img src="https://file.302.ai/gpt/imgs/5b36b96aaa052387fb3ccec2a063fe1e.png" width={30} height={30} className="object-contain mt-2" />
                        <div className="my-1 p-2 w-20 flex justify-center" style={{ backgroundColor: "#e2f4e8", border: "0.8px solid #e2f4e8" }}>
                          <div className="loader"></div>
                        </div>
                      </div>
                    }
                  </div>
                </div>
                <div className="flex gap-2 my-2 px-5">
                  <Input onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const dom = window.document.getElementById("query-button-desktop")
                      dom && dom.click()
                    }
                  }} disabled={!parsedPaper || querying} value={query} onChange={(e) => setQuery(e.target.value)} className="bg-white" placeholder={t("questioning.tips")} />
                  <Button id="query-button-desktop" onClick={() => {
                    setParseErr(undefined)
                    queryPaper()
                  }} disabled={!parsedPaper || !query}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.20308 1.04312C1.00481 0.954998 0.772341 1.0048 0.627577 1.16641C0.482813 1.32802 0.458794 1.56455 0.568117 1.75196L3.92115 7.50002L0.568117 13.2481C0.458794 13.4355 0.482813 13.672 0.627577 13.8336C0.772341 13.9952 1.00481 14.045 1.20308 13.9569L14.7031 7.95693C14.8836 7.87668 15 7.69762 15 7.50002C15 7.30243 14.8836 7.12337 14.7031 7.04312L1.20308 1.04312ZM4.84553 7.10002L2.21234 2.586L13.2689 7.50002L2.21234 12.414L4.84552 7.90002H9C9.22092 7.90002 9.4 7.72094 9.4 7.50002C9.4 7.27911 9.22092 7.10002 9 7.10002H4.84553Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col mobile-data-list absolute left-0 right-0 top-0 bottom-0">
          <div className="px-2 pr-8 pb-2 mt-3 text-sm font-bold" style={{ borderBottom: "0.8px solid rgb(240, 240, 243" }}>
            [ {document?.translated_title || document?.title} ]
          </div>
          <div className="flex py-1 pl-1 px-3 font-bold text-sm" >
            <div onClick={() => setMobileActiveTab("paper")} className="w-20 text-center" style={{ padding: "2.5px", borderBottom: mobileActiveTab === "paper" ? "2px solid #296d4d" : "1px solid #f0f0f3", color: mobileActiveTab === "paper" ? "#296d4d" : "#8c8f95" }}>{t("thesis")}</div>
            <div onClick={() => setMobileActiveTab("summary")} className={cn("text-center cursor-pointer", global.language === 'zh' ? "w-20" : "w-24")} style={{ padding: "2.5px", borderBottom: mobileActiveTab === "summary" ? "2px solid #296d4d" : "1px solid #f0f0f3", color: mobileActiveTab === "summary" ? "#296d4d" : "#8c8f95" }}>{t("full_text_summary")}</div>
            <div onClick={() => setMobileActiveTab("translate")} className={cn("text-center cursor-pointer", global.language === 'zh' ? "w-20" : "w-24")} style={{ padding: "2.5px", borderBottom: mobileActiveTab === "translate" ? "2px solid #296d4d" : "1px solid #f0f0f3", color: mobileActiveTab === "translate" ? "#296d4d" : "#8c8f95" }}>{t("full_text_translation")}</div>
            <div onClick={() => setMobileActiveTab("query")} className="w-20 text-center" style={{ padding: "2.5px", borderBottom: mobileActiveTab === "query" ? "2px solid #296d4d" : "1px solid #f0f0f3", color: mobileActiveTab === "query" ? "#296d4d" : "#8c8f95" }}>{t("ai_qa")}</div>
          </div>
          <div className="flex-1 relative">
            {onRendering()}
            <div className={cn("absolute left-0 right-0 top-0 bottom-0 flex-1 flex flex-col", mobileActiveTab === "summary" ? "" : "hidden")} style={{ backgroundColor: "#f7f9f8" }}>
              <div className="flex-1 m-1 text-sm overflow-y-auto" style={{ backgroundColor: "#eff3f2", color: "#282c2b" }}>
                {(summary || summarying) ? <div id="summary-mobile" className="text-base p-2 pt-1 overflow-y-auto">
                  {summary?.history.map(history => <div key={history} className="my-1 p-2" style={{ backgroundColor: "#e2f4e8", border: "0.8px solid #e2f4e8" }}>{history.replace("user_say-", "").replace("gpt_say-", "")}</div>)}
                  {summarying && <Theme className="my-1 p-2 flex gap-2 items-center" style={{ backgroundColor: "#e2f4e8", border: "0.8px solid #e2f4e8" }}>
                    <div style={{ color: "rgb(41, 109, 77)" }}>{t("summary_progress")} {summary?.progress || 0} %</div>
                    <Spinner />
                  </Theme>}
                  {
                    summaryErr && <div className="my-1 p-2 flex gap-2" style={{ backgroundColor: "#ffe9f0", border: "0.8px solid #ffe9f0", color: "#d13372" }}>
                      {summaryErr}
                      <div> {t("or")} <span className="underline cursor-pointer" onClick={() => {
                        setSummary(undefined)
                        setSummaryErr(undefined)
                        generateSummary()
                      }} style={{ color: "rgb(0, 112, 240)" }}>{t("translation_summary_retry ")}</span></div>
                    </div>
                  }
                </div> : <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-2/3 -translate-y-1/2 flex flex-col justify-center items-center cursor-pointer py-7 rounded-2xl" style={{ backgroundColor: "rgb(208 208 208 / 30%)" }} onClick={generateSummary}>
                  <svg width="55" height="55" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 2.5C3 2.22386 3.22386 2 3.5 2H9.08579C9.21839 2 9.34557 2.05268 9.43934 2.14645L11.8536 4.56066C11.9473 4.65443 12 4.78161 12 4.91421V12.5C12 12.7761 11.7761 13 11.5 13H3.5C3.22386 13 3 12.7761 3 12.5V2.5ZM3.5 1C2.67157 1 2 1.67157 2 2.5V12.5C2 13.3284 2.67157 14 3.5 14H11.5C12.3284 14 13 13.3284 13 12.5V4.91421C13 4.51639 12.842 4.13486 12.5607 3.85355L10.1464 1.43934C9.86514 1.15804 9.48361 1 9.08579 1H3.5ZM4.5 4C4.22386 4 4 4.22386 4 4.5C4 4.77614 4.22386 5 4.5 5H7.5C7.77614 5 8 4.77614 8 4.5C8 4.22386 7.77614 4 7.5 4H4.5ZM4.5 7C4.22386 7 4 7.22386 4 7.5C4 7.77614 4.22386 8 4.5 8H10.5C10.7761 8 11 7.77614 11 7.5C11 7.22386 10.7761 7 10.5 7H4.5ZM4.5 10C4.22386 10 4 10.2239 4 10.5C4 10.7761 4.22386 11 4.5 11H10.5C10.7761 11 11 10.7761 11 10.5C11 10.2239 10.7761 10 10.5 10H4.5Z" fill="#8c8f95" fillRule="evenodd" clipRule="evenodd"></path></svg>
                  <div className=" text-lg font-bold" style={{ color: "#8c8f95" }}>{t("translation_summary")}</div>
                </div>}
              </div>
            </div>
            <div className={cn("absolute left-0 right-0 top-0 bottom-0 flex-1 flex flex-col", mobileActiveTab === "translate" ? "" : "hidden")} style={{ backgroundColor: "#f7f9f8" }}>
              <div className="flex-1 m-1 text-sm overflow-y-auto relative" style={{ backgroundColor: "#eff3f2", color: "#282c2b" }}>
                {!translatePdfUrl && <div className="flex-1 text-sm mb-2 absolute overflow-y-auto left-0 right-0 top-0 bottom-0" style={{ backgroundColor: "#eff3f2", color: "#282c2b" }}>
                  {(fullTextTranslation || translating || translateErr) ? <div id="translate" className="text-base p-2 pt-1 overflow-y-auto">
                    {fullTextTranslation?.history.map(history => <div key={history} className="my-1 p-2" style={{ backgroundColor: "#e2f4e8", border: "0.8px solid #e2f4e8", width: translateWidth ? translateWidth : undefined }}>
                      {history.indexOf("translate_html-") > -1 && (
                        history.replace("translate_html-", "") ?
                          <a href={DOMAIN_NAME_URL + history.replace("translate_html-", "")} target="_blank" className="underline" style={{ color: "rgb(0, 112, 240)" }}>{t("full_text_translation_html_success")}</a> :
                          (t("full_text_translation_html_error"))
                      )}
                      {history.indexOf("merge_translate_zh_pdf_url-") > -1 && <></>}
                      {history.indexOf("merge_translate_zh_pdf_url-") > -1 && (
                        history.replace("merge_translate_zh_pdf_url-", "") ?
                          <a href={history.replace("merge_translate_zh_pdf_url-", "")} target="_blank" className="underline" style={{ color: "rgb(0, 112, 240)" }}>{t("full_text_translation_pdf_success")}</a> :
                          (t("full_text_translation_pdf_error"))
                      )}
                      {history.indexOf("zip_302_url-") > -1 && (
                        history.replace("zip_302_url-", "") ?
                          <a href={history.replace("zip_302_url-", "")} target="_blank" className="underline" style={{ color: "rgb(0, 112, 240)" }}>{t("full_text_translation_generation")}</a> :
                          (t("full_text_translation_error"))
                      )}
                      {history.indexOf("merge_translate_zh_pdf_url-") === -1 && history.indexOf("translate_html-") === -1 && history.indexOf("zip_302_url-") === -1 && history.replace("user_say-", "").replace("gpt_say-", "")}
                    </div>)}
                    {translating && <Theme className="my-1 p-2 flex gap-2 items-center" style={{ backgroundColor: "#e2f4e8", border: "0.8px solid #e2f4e8" }}>
                      <div style={{ color: "rgb(41, 109, 77)" }}>{t("translation_progress")} {fullTextTranslation?.progress || 0} %</div>
                      <Spinner />
                    </Theme>}
                    {
                      translateErr && <div className="my-1 p-2 flex gap-2" style={{ backgroundColor: "#ffe9f0", border: "0.8px solid #ffe9f0", color: "#d13372" }}>
                        {translateErr}
                        <div> {t("or")} <span className="underline cursor-pointer" onClick={() => {
                          setFullTextTranslation(undefined)
                          setTranslateErr(undefined)
                          getTranslate()
                        }} style={{ color: "rgb(0, 112, 240)" }}>{t("retry_to_generate")}</span></div>
                      </div>
                    }
                  </div> : <div onClick={getTranslate} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col justify-center items-center cursor-pointer py-7 w-3/4 rounded-2xl" style={{ backgroundColor: "rgb(208 208 208 / 30%)" }}>
                    <svg width="60" height="60" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.49996 1.80002C4.35194 1.80002 1.79996 4.352 1.79996 7.50002C1.79996 10.648 4.35194 13.2 7.49996 13.2C10.648 13.2 13.2 10.648 13.2 7.50002C13.2 4.352 10.648 1.80002 7.49996 1.80002ZM0.899963 7.50002C0.899963 3.85494 3.85488 0.900024 7.49996 0.900024C11.145 0.900024 14.1 3.85494 14.1 7.50002C14.1 11.1451 11.145 14.1 7.49996 14.1C3.85488 14.1 0.899963 11.1451 0.899963 7.50002Z" fill="#8c8f95" fillRule="evenodd" clipRule="evenodd"></path><path d="M13.4999 7.89998H1.49994V7.09998H13.4999V7.89998Z" fill="#8c8f95" fillRule="evenodd" clipRule="evenodd"></path><path d="M7.09991 13.5V1.5H7.89991V13.5H7.09991zM10.375 7.49998C10.375 5.32724 9.59364 3.17778 8.06183 1.75656L8.53793 1.24341C10.2396 2.82218 11.075 5.17273 11.075 7.49998 11.075 9.82724 10.2396 12.1778 8.53793 13.7566L8.06183 13.2434C9.59364 11.8222 10.375 9.67273 10.375 7.49998zM3.99969 7.5C3.99969 5.17611 4.80786 2.82678 6.45768 1.24719L6.94177 1.75281C5.4582 3.17323 4.69969 5.32389 4.69969 7.5 4.6997 9.67611 5.45822 11.8268 6.94179 13.2472L6.45769 13.7528C4.80788 12.1732 3.9997 9.8239 3.99969 7.5z" fill="#8c8f95" fillRule="evenodd" clipRule="evenodd"></path><path d="M7.49996 3.95801C9.66928 3.95801 11.8753 4.35915 13.3706 5.19448 13.5394 5.28875 13.5998 5.50197 13.5055 5.67073 13.4113 5.83948 13.198 5.89987 13.0293 5.8056 11.6794 5.05155 9.60799 4.65801 7.49996 4.65801 5.39192 4.65801 3.32052 5.05155 1.97064 5.8056 1.80188 5.89987 1.58866 5.83948 1.49439 5.67073 1.40013 5.50197 1.46051 5.28875 1.62927 5.19448 3.12466 4.35915 5.33063 3.95801 7.49996 3.95801zM7.49996 10.85C9.66928 10.85 11.8753 10.4488 13.3706 9.6135 13.5394 9.51924 13.5998 9.30601 13.5055 9.13726 13.4113 8.9685 13.198 8.90812 13.0293 9.00238 11.6794 9.75643 9.60799 10.15 7.49996 10.15 5.39192 10.15 3.32052 9.75643 1.97064 9.00239 1.80188 8.90812 1.58866 8.9685 1.49439 9.13726 1.40013 9.30601 1.46051 9.51924 1.62927 9.6135 3.12466 10.4488 5.33063 10.85 7.49996 10.85z" fill="#8c8f95" fillRule="evenodd" clipRule="evenodd"></path></svg>
                    <div className=" text-lg font-bold text-center" style={{ color: "#8c8f95" }}>{t("click_to_generate_a_full")}</div>
                  </div>}
                </div>}
                {translatePdfUrl && (userAgent.indexOf("iphone") === -1 ? <iframe className="mx-5" src={translatePdfUrl + "#navpanes=0&toolbar=1"} height="100%" /> : <a href={document.pdf_url.replace("http://", "https://") + "#navpanes=0&toolbar=0"} target="_blank" style={{ backgroundColor: "#eff3f2", color: "#0070f0" }} className="absolute top-0 left-0 right-0 bottom-0 flex justify-center items-center font-bold">{t("open_pdf")}</a>)}
              </div>
            </div>
            <div className={cn("absolute left-0 right-0 top-0 bottom-0 flex-1 flex flex-col", mobileActiveTab === "query" ? "" : "hidden")} style={{ backgroundColor: "#f7f9f8" }}>
              <div className="flex-1 mx-1 mt-1 text-sm relative" style={{ backgroundColor: "#eff3f2", color: "#282c2b" }}>
                <div id="answer-mobile" className="text-base overflow-y-auto p-2 pt-1 absolute top-0 bottom-0 left-0 right-0">
                  {(!parsedPaper && !parsingPaper && parseErr === undefined) && <div onClick={parsePaper} className="absolute top-1/2 left-1/2 -translate-x-1/2 w-4/5 -translate-y-1/2 flex flex-col justify-center items-center cursor-pointer py-7 px-3 rounded-2xl" style={{ backgroundColor: "rgb(208 208 208 / 30%)" }}>
                    <svg width="55" height="55" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.900024 7.50002C0.900024 3.85495 3.85495 0.900024 7.50002 0.900024C11.1451 0.900024 14.1 3.85495 14.1 7.50002C14.1 11.1451 11.1451 14.1 7.50002 14.1C3.85495 14.1 0.900024 11.1451 0.900024 7.50002ZM7.50002 1.80002C4.35201 1.80002 1.80002 4.35201 1.80002 7.50002C1.80002 10.648 4.35201 13.2 7.50002 13.2C10.648 13.2 13.2 10.648 13.2 7.50002C13.2 4.35201 10.648 1.80002 7.50002 1.80002ZM3.07504 7.50002C3.07504 5.05617 5.05618 3.07502 7.50004 3.07502C9.94388 3.07502 11.925 5.05617 11.925 7.50002C11.925 9.94386 9.94388 11.925 7.50004 11.925C5.05618 11.925 3.07504 9.94386 3.07504 7.50002ZM7.50004 3.92502C5.52562 3.92502 3.92504 5.52561 3.92504 7.50002C3.92504 9.47442 5.52563 11.075 7.50004 11.075C9.47444 11.075 11.075 9.47442 11.075 7.50002C11.075 5.52561 9.47444 3.92502 7.50004 3.92502ZM7.50004 5.25002C6.2574 5.25002 5.25004 6.25739 5.25004 7.50002C5.25004 8.74266 6.2574 9.75002 7.50004 9.75002C8.74267 9.75002 9.75004 8.74266 9.75004 7.50002C9.75004 6.25738 8.74267 5.25002 7.50004 5.25002ZM6.05004 7.50002C6.05004 6.69921 6.69923 6.05002 7.50004 6.05002C8.30084 6.05002 8.95004 6.69921 8.95004 7.50002C8.95004 8.30083 8.30084 8.95002 7.50004 8.95002C6.69923 8.95002 6.05004 8.30083 6.05004 7.50002Z" fill="#8c8f95" fillRule="evenodd" clipRule="evenodd"></path></svg>
                    <div className="font-bold text-center text-lg" style={{ color: "#8c8f95" }}>{t("ai_analysis")}</div>
                  </div>}
                  {queryInfo?.history.map((history, index) => <>
                    {
                      history.indexOf("query-user_say-") === -1 && <>
                        {
                          history.indexOf("err_code-") === -1 && <div key={index} className="flex items-start gap-2">
                            <img src="https://file.302.ai/gpt/imgs/5b36b96aaa052387fb3ccec2a063fe1e.png" width={30} height={30} className="object-contain mt-2" />
                            <div key={index} className="my-1 p-2" style={{ backgroundColor: "#e2f4e8", border: "0.8px solid #e2f4e8", wordWrap: 'break-word', width: 'calc(100vw - 75px)' }} dangerouslySetInnerHTML={{ __html: history.replace("query-", "").replace("gpt_say-", "").replace("user_say-", "") }}></div>
                          </div>
                        }
                        {
                          history.indexOf("err_code-") > -1 && <>
                            <div key={index} className="flex items-start gap-2">
                              <img src="https://file.302.ai/gpt/imgs/5b36b96aaa052387fb3ccec2a063fe1e.png" width={30} height={30} className="object-contain mt-2" />
                              <div key={index} className="my-1 p-2" style={{ backgroundColor: "#ffe9f0", border: "0.8px solid #ffe9f0", color: "#d13372" }}>
                                {history.indexOf("-10001") > -1 && ErrMessage(-10001, global.language, region)}
                                {history.indexOf("-10002") > -1 && ErrMessage(-10002, global.language, region)}
                                {history.indexOf("-10003") > -1 && ErrMessage(-10003, global.language, region)}
                                {history.indexOf("-10004") > -1 && ErrMessage(-10004, global.language, region)}
                                {history.indexOf("-10005") > -1 && ErrMessage(-10005, global.language, region)}
                                {history.indexOf("-10006") > -1 && ErrMessage(-10006, global.language, region)}
                                {history.indexOf("-10007") > -1 && ErrMessage(-10007, global.language, region)}
                                {history.indexOf("-10008") > -1 && ErrMessage(-10008, global.language, region)}
                                {history.indexOf("-10009") > -1 && ErrMessage(-10009, global.language, region)}
                                {history.indexOf("-10012") > -1 && ErrMessage(-10012, global.language, region)}
                                {history.indexOf("-1024") > -1 && ErrMessage(-1024, global.language, region)}
                              </div>
                            </div>
                          </>
                        }
                      </>
                    }
                    {
                      history.indexOf("query-user_say-") > -1 && <div className="flex justify-end">
                        <div key={index} className="my-1 p-2 inline-block" style={{ backgroundColor: "#e6f4fe", border: "0.8px solid #e6f4fe", color: "#006dcbf2" }}>{history.replace("query-user_say-", "")}</div>
                      </div>
                    }
                  </>)}
                  {parsingPaper && <div className="flex items-start gap-2">
                    <img src="https://file.302.ai/gpt/imgs/5b36b96aaa052387fb3ccec2a063fe1e.png" width={30} height={30} className="object-contain mt-2" />
                    <Theme className="my-1 p-2 flex gap-2 items-center" style={{ backgroundColor: "#e2f4e8", border: "0.8px solid #e2f4e8" }}>
                      <div style={{ color: "rgb(41, 109, 77)" }}>{t("analyze_progress")} {queryInfo?.progress || 0} %</div>
                      <Spinner />
                    </Theme>
                  </div>}
                  {
                    parseErr && <div className="flex items-start gap-2">
                      <img src="https://file.302.ai/gpt/imgs/5b36b96aaa052387fb3ccec2a063fe1e.png" width={30} height={30} className="object-contain mt-2" />
                      <div className="my-1 p-2 flex gap-2 items-center cursor-pointer" style={{ backgroundColor: "#ffe9f0", border: "0.8px solid #ffe9f0", color: "#d13372" }}>
                        {parseErr}
                        <div> {t("or")} <span onClick={() => {
                          setParseErr(undefined)
                          setQueryInfo(undefined)
                          parsePaper()
                        }} className="underline font-bold" style={{ color: "rgb(0, 112, 240)" }}>{t("reanalyze_ai")}</span></div>
                      </div>
                    </div>
                  }
                  {
                    querying && <div className="flex items-start gap-2">
                      <img src="https://file.302.ai/gpt/imgs/5b36b96aaa052387fb3ccec2a063fe1e.png" width={30} height={30} className="object-contain mt-2" />
                      <div className="my-1 p-2 w-20 flex justify-center" style={{ backgroundColor: "#e2f4e8", border: "0.8px solid #e2f4e8" }}>
                        <div className="loader"></div>
                      </div>
                    </div>
                  }
                </div>
              </div>
              <div className="flex gap-2 my-2 px-5">
                <Input onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const dom = window.document.getElementById("query-button-mobile")
                    dom && dom.click()
                  }
                }} disabled={!parsedPaper} value={query} onChange={(e) => setQuery(e.target.value)} className="bg-white" placeholder={t("questioning.tips")} />
                <Button id="query-button-mobile" onClick={() => {
                  setParseErr(undefined)
                  queryPaper()
                }} disabled={!parsedPaper || !query}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.20308 1.04312C1.00481 0.954998 0.772341 1.0048 0.627577 1.16641C0.482813 1.32802 0.458794 1.56455 0.568117 1.75196L3.92115 7.50002L0.568117 13.2481C0.458794 13.4355 0.482813 13.672 0.627577 13.8336C0.772341 13.9952 1.00481 14.045 1.20308 13.9569L14.7031 7.95693C14.8836 7.87668 15 7.69762 15 7.50002C15 7.30243 14.8836 7.12337 14.7031 7.04312L1.20308 1.04312ZM4.84553 7.10002L2.21234 2.586L13.2689 7.50002L2.21234 12.414L4.84552 7.90002H9C9.22092 7.90002 9.4 7.72094 9.4 7.50002C9.4 7.27911 9.22092 7.10002 9 7.10002H4.84553Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
}