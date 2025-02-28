import { Button } from "../ui/button";
import { useTranslation } from 'react-i18next'; // Importing the translation hook
import { FaEye } from "react-icons/fa";
import { LuHistory } from "react-icons/lu";
import { useEffect, useState } from "react";
import DocumentDialog from "../DocumentDialog";
import { MdFileDownload } from "react-icons/md";
import { MdDeleteOutline } from "react-icons/md";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/Popover";
import { Data, deleteData, getDataList, IAIAcademicRecordList } from "./indexedDB";
import { toast } from 'react-toastify';
const DOMAIN_NAME_URL = import.meta.env.VITE_APP_DOMAIN_NAME_URL;

export function HistoricalRecords(props: { onPreview: (item: IAIAcademicRecordList) => void }) {
  const [recordList, setRecordList] = useState<IAIAcademicRecordList[]>([]);
  const [open, setOpen] = useState(false);
  const { t } = useTranslation(); // Initialize translation

  useEffect(() => {
    if (open) {
      getDataList().then(res => {
        setRecordList(res);
      });
    }
  }, [open]);

  const onDel = async (id: number) => {
    const result = await deleteData(id);
    setRecordList(result);
  };

  const onDownload = async (url: string) => {
    const filename = url.split('/').pop() || 'document.pdf';
    const toastId = toast.warning(t('downloadingMessage')); // Downloading message
    fetch(`${DOMAIN_NAME_URL}/api/v1/pdf?url=${url}`)
      .then(response => response.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        toast.dismiss(toastId);
      })
      .catch(() => {
        toast.error(t('downloadFailed')); // Download failed message
      });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="p-0 m-0"><LuHistory className="text-lg" /></Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] max-h-[300px] overflow-y-auto" align="end" side="bottom">
        <div className="grid grid-cols-1 gap-4">
          {
            recordList.length ? recordList.map(item => (
              <div className="flex items-center justify-between gap-5" key={item.id}>
                <div className="w-full overflow-hidden grid gap-1">
                  <div className="text-sm font-bold flex items-center gap-1">
                    <div className="min-w-fit">{item.type === 'translate' ? t('translationResult') // Translation key
                      : item.type === 'search' ? t('searchResult') // Translation key
                      : t('fullTextSummary')} // Translation key
                    </div>
                    <p className="text-slate-600 font-medium text-ellipsis whitespace-nowrap overflow-hidden w-[130px]">{item.title}</p>
                  </div>
                  <div className="text-slate-500 text-xs">{item.created_at}</div>
                </div>
                <div className="flex items-center gap-3">
                  {
                    item.type === 'translate' ?
                      <MdFileDownload className='cursor-pointer' onClick={() => onDownload(item?.translateFiel || '')} /> :
                      item.type === 'search' ?
                        <FaEye className='cursor-pointer' onClick={() => props.onPreview(item)} /> :
                        <DocumentDialog document={item.summary?.item as Data} searchType={item.summary?.searchType} isRecord={true} recordData={item} />
                  }
                  <MdDeleteOutline className="text-rose-700 cursor-pointer" onClick={() => { onDel(item.id || 0) }} />
                </div>
              </div>
            )) :
              <div className="flex flex-col gap-5 items-center justify-center font-bold text-slate-500">
                <img src="/empty.png" className="w-[150px]" />
                {t('noHistoryRecords')} // Translation key
              </div>
          }
        </div>
      </PopoverContent>
    </Popover>
  );
}
