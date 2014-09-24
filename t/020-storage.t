#!/usr/bin/perl

use strict;
use warnings;

use JSON::XS;
use Path::Class qw[ dir ];

use Test::More;
use Test::Fatal;

BEGIN {
    use_ok('Plack::Debugger::Storage');
}

my $JSON     = JSON::XS->new->utf8->pretty;
my $DATA_DIR = dir('./t/tmp/');

# cleanup tmp dir
{ -f $_ && $_->remove foreach $DATA_DIR->children( no_hidden => 1 ) }

{
    my $storage = Plack::Debugger::Storage->new(
        data_dir     => $DATA_DIR,
        serializer   => sub { $JSON->encode( shift ) },
        deserializer => sub { $JSON->decode( shift ) },
        filename_fmt => "%s.json",
    );

    is($storage->data_dir,     $DATA_DIR, '... got the expected data_dir');
    is($storage->filename_fmt, '%s.json', '... got the expected filename_fmt');

    ok($storage->serializer,   '... got a serializer as expected');
    ok($storage->deserializer, '... got a deserializer as expected');

    ok(!-e $DATA_DIR->file('1234.json'), '... the data file does not exist (yet)');

    my $request_uid     = '1234';
    my $request_results = { testing => [ 1, 2, 3, 4 ] };

    is(
        exception {
            $storage->store_request_results( $request_uid, $request_results );
        }, 
        undef, 
        '... stored request results successfully'
    );

    ok(-e $DATA_DIR->file('1234.json'), '... the data file does exist now');

    my $stored_results;
    is(
        exception {
            $stored_results = $storage->load_request_results( $request_uid )
        },
        undef,
        '... loaded request results successfully'
    );

    is_deeply( $request_results, $stored_results, '... got the same results back' );
}


done_testing;







