export namespace MessageDto {
  export type MsgType = 'SMS' | 'MMS' | 'KKO' | 'RCS';

  export interface WhereParams {
    dateFrom?: Date;
    dateTo?: Date;
    destaddr?: string;
    messageState?: number;
    messageStateIn?: number[];
    userId?: string;
    groupId?: number;
    resultCode?: string;
    subTypeFilter?: string;
  }

  export interface RawTranRow {
    msg_id: bigint;
    msg_type: string;
    msg_sub_type: string;
    destaddr: string;
    callback: string;
    send_msg: string | null;
    message_state: number;
    result_code: string | null;
    result_net_id: string | null;
    result_deliver_date: Date | null;
    request_date: Date;
    create_date: Date;
    user_id: string | null;
    group_id: number | null;
    _channel: string;
  }

  export type MessageGetResultInput = {
    msgId: string;
    date: string;
    msgType?: string;
  };

  export type MessageSearchInput = {
    dateFrom?: string;
    dateTo?: string;
    destaddr?: string;
    msgType?: string;
    messageState?: number;
    userId?: string;
    groupId?: string;
    page?: number;
    size?: number;
  };

  export type MessageFindFailuresInput = {
    dateFrom?: string;
    dateTo?: string;
    msgType?: string;
    resultCode?: string;
    page?: number;
    size?: number;
  };

  export type MessageResultCodeExplainInput = {
    resultCode?: string;
  };

  export type MessageCheckPendingInput = {
    olderThanMinutes?: number;
    msgType?: string;
  };

  export type MessageRetryInput = {
    msgIds?: string[];
    resultCode?: string;
    dateFrom?: string;
    dateTo?: string;
    maxCount?: number;
  };

  export type MessageCancelInput = {
    msgIds?: string[];
    groupId?: string;
  };

  export type MessageStatSummaryInput = {
    dateFrom?: string;
    dateTo?: string;
    groupBy?: string;
  };

  export type MessageDiagnoseFailuresInput = {
    dateFrom?: string;
    dateTo?: string;
    msgType?: string;
  };

  export type MessageDailyReportInput = {
    date?: string;
  };

  export type MessageWeeklyReportInput = {
    weekStartDate?: string;
  };

  export type MessageChannelBreakdownInput = {
    dateFrom?: string;
    dateTo?: string;
  };

  export type MessageDeliveryTimeStatsInput = {
    dateFrom?: string;
    dateTo?: string;
    msgType?: string;
  };

  export type MessageTrendCompareInput = {
    periodA_from: string;
    periodA_to: string;
    periodB_from: string;
    periodB_to: string;
    groupBy?: string;
  };

  export type MessageSendInput = {
    msgType: string;
    msgSubType: string;
    destaddr: string;
    callback: string;
    sendMsg: string;
    subject?: string;
    filePath?: string;
    userId?: string;
    kisaCode?: string;
    billCode?: string;
    groupId?: string;
    requestDate?: string;
  };

  export type MessageSendResult = {
    msgId: string;
    msgType: string;
    msgSubType: string;
    destaddr: string;
    tableName: string;
    requestDate: string;
  };
}
