FROM debian:stretch

RUN apt-get update

RUN apt-get install -y --no-install-recommends --fix-missing \
  less \
  vim \
  openjdk-8-jdk \
  procps

WORKDIR /var/lib/solr
COPY solr-dist.tar.gz /var/lib/solr/
RUN tar xf solr-dist.tar.gz
RUN rm solr-dist.tar.gz

VOLUME /var/lib/solr/dist/server/solr

CMD ["/var/lib/solr/dist/bin/solr", "start", "-f"]
