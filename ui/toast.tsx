import React from "react";

interface ToastProps {
  text: string;
  subText?: string;
  type?: "success" | "error" | "info";
  onClose?: () => void;
}

export default function Toast({ text, type = "success", onClose }: ToastProps) {
  const isError = type === "error";

  return (
    <div className="w-[330px] h-20 rounded-lg p-2.5 px-3.5 bg-white shadow-[rgba(149,157,165,0.2)_0px_8px_24px] relative overflow-hidden flex items-center justify-between gap-3.5 border border-neutral-100/85 text-left">
      {/* Wave Graphic */}
      <svg
        className="absolute rotate-90 left-[-31px] top-8 w-20 pointer-events-none"
        viewBox="0 0 1440 320"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          fill: isError ? "rgba(252, 12, 12, 0.22)" : "rgba(16, 185, 129, 0.22)",
        }}
      >
        <path d="M0,256L11.4,240C22.9,224,46,192,69,192C91.4,192,114,224,137,234.7C160,245,183,235,206,213.3C228.6,192,251,160,274,149.3C297.1,139,320,149,343,181.3C365.7,213,389,267,411,282.7C434.3,299,457,277,480,250.7C502.9,224,526,192,549,181.3C571.4,171,594,181,617,208C640,235,663,277,686,256C708.6,235,731,149,754,122.7C777.1,96,800,128,823,165.3C845.7,203,869,245,891,224C914.3,203,937,117,960,112C982.9,107,1006,181,1029,197.3C1051.4,213,1074,171,1097,144C1120,117,1143,107,1166,133.3C1188.6,160,1211,224,1234,218.7C1257.1,213,1280,139,1303,133.3C1325.7,128,1349,192,1371,192C1394.3,192,1417,128,1429,96L1440,64L1440,320L1428.6,320C1417.1,320,1394,320,1371,320C1348.6,320,1326,320,1303,320C1280,320,1257,320,1234,320C1211.4,320,1189,320,1166,320C1142.9,320,1120,320,1097,320C1074.3,320,1051,320,1029,320C1005.7,320,983,320,960,320C937.1,320,914,320,891,320C868.6,320,846,320,823,320C800,320,777,320,754,320C731.4,320,709,320,686,320C662.9,320,640,320,617,320C594.3,320,571,320,549,320C525.7,320,503,320,480,320C457.1,320,434,320,411,320C388.6,320,366,320,343,320C320,320,297,320,274,320C251.4,320,229,320,206,320C182.9,320,160,320,137,320C114.3,320,91,320,69,320C45.7,320,23,320,11,320L0,320Z" />
      </svg>

      {/* Icon Container */}
      <div
        className="w-9 h-9 flex items-center justify-center rounded-full shrink-0 ml-1"
        style={{
          backgroundColor: isError ? "rgba(252, 12, 12, 0.2)" : "rgba(16, 185, 129, 0.2)",
        }}
      >
        {isError ? (
          /* Cross Circle Icon */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            fill="currentColor"
            className="w-[17px] h-[17px]"
            style={{ color: "#d10d0d" }}
          >
            <path d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c-9.4 9.4-9.4 24.6 0 33.9l47 47-47 47c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l47-47 47 47c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-47-47 47-47c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-47 47-47-47c-9.4-9.4-24.6-9.4-33.9 0z" />
          </svg>
        ) : (
          /* Success Checkmark Icon */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="3.5"
            stroke="currentColor"
            className="w-4 h-4"
            style={{ color: "#047857" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        )}
      </div>

      {/* Message text container */}
      <div className="flex flex-col justify-center items-start grow min-w-0 text-left pl-1.5">
        <p
          className="text-[13.5px] font-extrabold m-0 leading-tight truncate w-full"
          style={{
            color: isError ? "#d10d0d" : "#047857",
          }}
        >
          {isError ? "Error message" : "Success"}
        </p>
        <p
          className="text-[11.5px] font-semibold text-neutral-500 m-0 mt-0.5 leading-snug line-clamp-2"
          title={text}
        >
          {text}
        </p>
      </div>

      {/* Cross Dismiss Icon */}
      {onClose && (
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-600 transition-colors p-1.5 rounded-md shrink-0 cursor-pointer hover:bg-neutral-50"
          aria-label="Dismiss notification"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 15 15"
            fill="none"
            stroke="currentColor"
            className="w-[15px] h-[15px]"
          >
            <path
              fill="currentColor"
              d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
              clipRule="evenodd"
              fillRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
