#!/usr/bin/perl

use strict;
use warnings;

use Test::More;

use Plack::Builder;

use Plack::Test::Debugger;    
use Plack::Test::Debugger::ResultGenerator;    
use HTTP::Request::Common qw[ GET PUT ];
use Path::Class           qw[ dir ];
use JSON::XS;

BEGIN {
    delete $ENV{'PLACK_DEBUGGER_DEBUG'};
    delete $ENV{'PLACK_DEBUGGER_CHAOS_MONKEY_LEVEL'};
}

BEGIN {
    use_ok('Plack::Debugger');
    use_ok('Plack::Debugger::Storage');

    use_ok('Plack::App::Debugger');
}

my $DATA_DIR = dir('./t/050-tmp-app-debugger/');
my $JSON     = $Plack::Test::Debugger::ResultGenerator::JSON;

# cleanup tmp dir
{ ((-f $_ && $_->remove) || (-d $_ && $_->rmtree)) foreach $DATA_DIR->children( no_hidden => 1 ) }

my $debugger = Plack::Debugger->new(
    storage => Plack::Debugger::Storage->new(
        data_dir     => $DATA_DIR,
        serializer   => sub { $JSON->encode( shift ) },
        deserializer => sub { $JSON->decode( shift ) },
        filename_fmt => $Plack::Test::Debugger::ResultGenerator::FILENAME_FMT,
    )
);

my $app = Plack::App::Debugger->new( debugger => $debugger )->to_app;

test_psgi($app, sub {
        my $cb  = shift;

        my $root_uid = create_root( $DATA_DIR );
        {
            my $resp = $cb->(GET '/' . $root_uid); 
            is_deeply(
                $JSON->decode( $resp->content ),
                result_generator( $root_uid ),
                '... got the expected data set (for base request)'
            ); 
        }

        {
            my $resp = $cb->(GET '/' . $root_uid . '/subrequests'); 
            is_deeply(
                $JSON->decode( $resp->content ),
                [],
                '... got the expected data set (for all sub-requests)'
            ); 
        }

        my @sub_uids;

        push @sub_uids => create_child( $DATA_DIR, $root_uid );
        {
            my $resp = $cb->(GET '/' . $root_uid . '/subrequests'); 
            is_deeply(
                $JSON->decode( $resp->content ),
                [ result_generator( $sub_uids[0], $root_uid ) ],
                '... got the expected data set (for all sub-requests (with one request))'
            ); 
        }
        {
            my $resp = $cb->(GET '/' . $root_uid . '/subrequests/' . $sub_uids[0]); 
            is_deeply(
                $JSON->decode( $resp->content ),
                result_generator( $sub_uids[0], $root_uid ),
                '... got the expected data set (for specific sub-request)'
            ); 
        }

        my $epoch = time;
        diag('... sleeping for a second to ensure mtime is different enough');
        sleep(1);

        push @sub_uids => create_child( $DATA_DIR, $root_uid );
        {
            my $resp = $cb->(GET '/' . $root_uid . '/subrequests', 
                (
                    'X-Plack-Debugger-SubRequests-Modified-Since' => $epoch
                )
            ); 

            is_deeply(
                $JSON->decode( $resp->content ),
                [ result_generator( $sub_uids[-1], $root_uid ) ],
                '... got the expected data set (for all sub-requests modified since epoch[' . $epoch . '])'
            ); 
        }
        {
            my $resp = $cb->(GET '/' . $root_uid . '/subrequests'); 
            is_deeply(
                $JSON->decode( $resp->content ),
                [ map { result_generator( $_, $root_uid ) } @sub_uids ],
                '... got the expected data set (for all (2) sub-requests)'
            ); 
        }

    }
);

# cleanup tmp dir
{ ((-f $_ && $_->remove) || (-d $_ && $_->rmtree)) foreach $DATA_DIR->children( no_hidden => 1 ) }

done_testing;







